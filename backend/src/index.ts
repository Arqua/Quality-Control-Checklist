import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { Pool, PoolClient } from 'pg';
import { authenticateToken, canAccessProject } from './auth';
import {
  validateSyncPayload,
  collectInstanceIds,
  validateAlertsPayload,
  validateDeviceRegistration,
  isUuid,
} from './validation';
import { storePhoto } from './storage';
import { pushAlert } from './push';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// In-memory photo handling with a sane size cap (8 MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Public health check (no auth).
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

/**
 * POST /auth/login
 * Validates credentials against hardcoded test accounts and returns a JWT.
 * For production, replace with database user lookup + password hashing (bcrypt).
 */
app.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  const key = username.trim().toLowerCase();
  const testAccounts: Record<string, { password: string; role: string }> = {
    admin: { password: '1234', role: 'manager' },
    manager: { password: '1234', role: 'manager' },
    inspector: { password: '1234', role: 'inspector' },
  };

  const account = testAccounts[key];
  if (!account || account.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth] JWT_SECRET not configured');
    return res.status(500).json({ success: false, error: 'Server error' });
  }

  const token = jwt.sign(
    {
      sub: key,
      username: key,
      role: account.role,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: '7d' }
  );

  return res.json({
    success: true,
    token,
    user: { username: key, role: account.role },
  });
});

// Every /api route requires a valid bearer token.
app.use('/api', authenticateToken);

/**
 * Builds a map of instanceId -> projectId using the payload's own instances
 * first, then filling gaps from the database. Used for permission enforcement.
 */
async function resolveInstanceProjects(
  client: PoolClient,
  body: any,
  instanceIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const inst of body?.instances ?? []) {
    if (inst?.id && inst?.project_id) map.set(inst.id, inst.project_id);
  }

  const missing = instanceIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const { rows } = await client.query(
      'SELECT id, project_id FROM checklist_instances WHERE id = ANY($1::uuid[])',
      [missing]
    );
    for (const row of rows) map.set(row.id, row.project_id);
  }
  return map;
}

/**
 * POST /api/sync
 * Validates and persists offline-first data, enforcing project-level access.
 */
app.post('/api/sync', async (req: Request, res: Response) => {
  // 1) Shape & content validation (untrusted input).
  const validation = validateSyncPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid sync payload',
      details: validation.errors,
    });
  }

  const { results = [], punchItems = [], instances = [] } = req.body;
  const client = await pool.connect();

  try {
    // 2) Permission check: the user must be allowed on every referenced project.
    const instanceIds = collectInstanceIds(req.body);
    const instanceProjects = await resolveInstanceProjects(
      client,
      req.body,
      instanceIds
    );

    for (const instanceId of instanceIds) {
      const projectId = instanceProjects.get(instanceId);
      if (!projectId || !canAccessProject(req.user, projectId)) {
        return res.status(403).json({
          success: false,
          error: `Not authorized to write to instance ${instanceId}`,
        });
      }
    }

    const syncedIds = {
      resultIds: [] as string[],
      punchItemIds: [] as string[],
      instanceIds: [] as string[],
    };

    await client.query('BEGIN');
    try {
      for (const instance of instances) {
        await upsertChecklistInstance(client, instance);
        syncedIds.instanceIds.push(instance.id);
      }
      for (const result of results) {
        await upsertChecklistResult(client, result);
        syncedIds.resultIds.push(result.id);
      }
      for (const punchItem of punchItems) {
        await upsertPunchItem(client, punchItem);
        syncedIds.punchItemIds.push(punchItem.id);
      }

      await logSync(client, {
        userId: req.user?.id ?? null,
        resultCount: results.length,
        punchItemCount: punchItems.length,
        payload: JSON.stringify({ results, punchItems, instances }),
      });

      await client.query('COMMIT');
      return res.json({
        success: true,
        synced: syncedIds,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    // Log the detail server-side; return a generic message so internal error
    // details (schema, constraints, etc.) are not disclosed to clients.
    console.error('[SYNC ERROR]', error);
    return res.status(500).json({ success: false, error: 'Sync failed' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/photos
 * Uploads a single inspection photo to object storage and records its URL.
 */
app.post('/api/photos', upload.single('photo'), async (req: Request, res: Response) => {
  const file = req.file;
  const resultId = req.body?.resultId as string | undefined;

  if (!file) {
    return res.status(400).json({ success: false, error: 'No photo uploaded' });
  }
  // resultId must be a UUID: it is used both as a SQL key and to build the
  // storage object key, so an unvalidated value enables path traversal /
  // arbitrary object writes (e.g. `../../etc/...`).
  if (!isUuid(resultId)) {
    return res.status(400).json({ success: false, error: 'resultId must be a UUID' });
  }

  const client = await pool.connect();
  try {
    // The result must exist and the caller must be authorized for its project.
    // Fail closed: a missing result is rejected rather than allowing a write to
    // an arbitrary, unowned storage key.
    const { rows } = await client.query(
      `SELECT ci.project_id AS project_id
         FROM checklist_results cr
         JOIN checklist_instances ci ON ci.id = cr.instance_id
        WHERE cr.id = $1`,
      [resultId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    if (!canAccessProject(req.user, rows[0].project_id)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this result' });
    }

    const key = `photos/${resultId}.jpg`;
    const stored = await storePhoto(key, file.buffer, file.mimetype || 'image/jpeg');

    await client.query(
      'UPDATE checklist_results SET photo_uri = $1, synced_at = NOW() WHERE id = $2',
      [stored.url, resultId]
    );

    return res.json({ success: true, photoUrl: stored.url });
  } catch (error) {
    console.error('[PHOTO ERROR]', error);
    return res.status(500).json({ success: false, error: 'Photo upload failed' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/projects — projects visible to the authenticated user.
 */
app.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const restricted =
      req.user?.role !== 'admin' &&
      Array.isArray(req.user?.projectIds) &&
      (req.user?.projectIds?.length ?? 0) > 0;

    const result = restricted
      ? await pool.query(
          'SELECT * FROM projects WHERE id = ANY($1::uuid[]) ORDER BY created_at DESC',
          [req.user?.projectIds]
        )
      : await pool.query('SELECT * FROM projects ORDER BY created_at DESC');

    res.json({ success: true, projects: result.rows });
  } catch (error) {
    console.error('[PROJECTS ERROR]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/templates — all templates with their items (templates are global).
 */
app.get('/api/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await pool.query(
      'SELECT * FROM templates ORDER BY division, name'
    );
    const items = await pool.query(
      'SELECT * FROM template_items ORDER BY template_id, sort_order'
    );

    const itemsByTemplate = new Map<string, any[]>();
    for (const item of items.rows) {
      const list = itemsByTemplate.get(item.template_id) ?? [];
      list.push(item);
      itemsByTemplate.set(item.template_id, list);
    }

    const payload = templates.rows.map((t) => ({
      ...t,
      items: itemsByTemplate.get(t.id) ?? [],
    }));

    res.json({ success: true, templates: payload });
  } catch (error) {
    console.error('[TEMPLATES ERROR]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch templates' });
  }
});

/**
 * POST /api/devices
 * Registers (or refreshes) the caller's Expo push token so their device can
 * receive management alert push notifications. Upserts on the token itself so a
 * reinstall/refresh updates the existing row rather than creating duplicates.
 */
app.post('/api/devices', async (req: Request, res: Response) => {
  const validation = validateDeviceRegistration(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid device registration',
      details: validation.errors,
    });
  }

  const { expoPushToken } = req.body;
  // SECURITY: role and project scope are taken from the verified JWT only —
  // never from the request body. Trusting client-supplied role/projectIds here
  // would let any authenticated user register as a 'manager' for arbitrary
  // projects and receive their alert push notifications.
  try {
    await pool.query(
      `INSERT INTO device_tokens (user_id, expo_push_token, role, project_ids, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (expo_push_token)
       DO UPDATE SET user_id = EXCLUDED.user_id,
                     role = EXCLUDED.role,
                     project_ids = EXCLUDED.project_ids,
                     updated_at = NOW()`,
      [
        req.user?.id ?? null,
        expoPushToken,
        req.user?.role ?? null,
        req.user?.projectIds ?? null,
      ]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('[DEVICE REGISTER ERROR]', error);
    return res.status(500).json({ success: false, error: 'Failed to register device' });
  }
});

/**
 * Returns the Expo push tokens of every manager who should receive an alert,
 * excluding the user who raised it. Honours project scoping: a manager
 * restricted to specific projects only receives alerts for those projects;
 * managers with no project restriction receive all.
 */
async function getAlertRecipientTokens(
  client: PoolClient,
  projectId: string | null,
  excludeUserId: string | null
): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT expo_push_token, project_ids
       FROM device_tokens
      WHERE role IN ('manager', 'admin')
        AND ($1::uuid IS NULL OR user_id IS NULL OR user_id <> $1)`,
    [excludeUserId]
  );

  return rows
    .filter((row) => {
      const scoped: string[] | null = row.project_ids;
      if (!scoped || scoped.length === 0) return true; // unrestricted manager
      if (!projectId) return true; // alert has no project; don't hide it
      return scoped.includes(projectId);
    })
    .map((row) => row.expo_push_token as string);
}

/**
 * POST /api/alerts
 * Receives serious (HIGH-severity) events recorded on a device, persists them,
 * and fans out an Expo push notification to other managers' registered devices.
 * Idempotent on alert id so re-syncs don't duplicate or re-notify.
 */
app.post('/api/alerts', async (req: Request, res: Response) => {
  const validation = validateAlertsPayload(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Invalid alerts payload',
      details: validation.errors,
    });
  }

  const { alerts } = req.body as { alerts: any[] };
  const client = await pool.connect();
  try {
    // Enforce project access for any alert that names a project.
    for (const alert of alerts) {
      if (alert.project_id && !canAccessProject(req.user, alert.project_id)) {
        return res.status(403).json({
          success: false,
          error: `Not authorized to raise alerts on project ${alert.project_id}`,
        });
      }
    }

    const accepted: string[] = [];
    let pushed = 0;

    for (const alert of alerts) {
      // Insert only if new; ON CONFLICT tells us whether a push is warranted.
      const inserted = await client.query(
        `INSERT INTO alerts
         (id, instance_id, result_id, project_id, title, body, severity, acknowledged, created_by, created_at, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8, $9, NOW())
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          alert.id,
          alert.instance_id,
          alert.result_id ?? null,
          alert.project_id ?? null,
          alert.title,
          alert.body,
          alert.severity,
          req.user?.id ?? null,
          alert.created_at,
        ]
      );

      accepted.push(alert.id);

      // Fan out only for newly-stored HIGH-severity alerts (avoids re-notifying
      // on re-sync and keeps low/medium events inbox-only).
      if (inserted.rows.length > 0 && alert.severity === 'HIGH') {
        const tokens = await getAlertRecipientTokens(
          client,
          alert.project_id ?? null,
          req.user?.id ?? null
        );
        const result = await pushAlert(tokens, alert);
        pushed += result.sent;
      }
    }

    return res.json({
      success: true,
      synced: { alertIds: accepted },
      pushed,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ALERTS ERROR]', error);
    return res.status(500).json({ success: false, error: 'Failed to store alerts' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/alerts
 * Returns alerts visible to the authenticated manager (newest first), so a
 * manager who wasn't on the originating device still sees them in their inbox.
 * Inspectors get an empty list. Supports `?since=<ISO>` for incremental pulls.
 */
app.get('/api/alerts', async (req: Request, res: Response) => {
  if (req.user?.role !== 'manager' && req.user?.role !== 'admin') {
    return res.json({ success: true, alerts: [] });
  }

  const since = req.query.since as string | undefined;
  const restricted =
    req.user?.role !== 'admin' &&
    Array.isArray(req.user?.projectIds) &&
    (req.user?.projectIds?.length ?? 0) > 0;

  try {
    const clauses: string[] = [];
    const params: any[] = [];
    if (since && !Number.isNaN(Date.parse(since))) {
      params.push(since);
      clauses.push(`created_at > $${params.length}`);
    }
    if (restricted) {
      params.push(req.user?.projectIds);
      // Include project-scoped alerts plus any project-less (global) alerts.
      clauses.push(`(project_id = ANY($${params.length}::uuid[]) OR project_id IS NULL)`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    );
    return res.json({ success: true, alerts: result.rows });
  } catch (error) {
    console.error('[ALERTS FETCH ERROR]', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Marks an alert acknowledged server-side so it can clear across managers'
 * devices on next pull.
 */
app.post('/api/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  if (req.user?.role !== 'manager' && req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Management access required' });
  }
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ success: false, error: 'Invalid alert id' });
  }
  // Project-restricted managers may only acknowledge alerts within their scope
  // (plus global, project-less alerts). Admins and unrestricted managers may
  // acknowledge any alert.
  const restricted =
    req.user?.role !== 'admin' &&
    Array.isArray(req.user?.projectIds) &&
    (req.user?.projectIds?.length ?? 0) > 0;
  try {
    const result = restricted
      ? await pool.query(
          `UPDATE alerts SET acknowledged = TRUE
             WHERE id = $1
               AND (project_id = ANY($2::uuid[]) OR project_id IS NULL)
           RETURNING id`,
          [req.params.id, req.user?.projectIds]
        )
      : await pool.query(
          'UPDATE alerts SET acknowledged = TRUE WHERE id = $1 RETURNING id',
          [req.params.id]
        );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('[ALERT ACK ERROR]', error);
    return res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

async function upsertChecklistResult(client: PoolClient, result: any) {
  const {
    id,
    instance_id,
    template_item_id,
    status,
    severity,
    comments,
    photo_remote_url,
    photo_local_uri,
    created_at,
    updated_at,
  } = result;

  // Prefer the uploaded remote URL; fall back to whatever URI the client sent.
  const photoUri = photo_remote_url ?? photo_local_uri ?? null;
  // Severity only applies to failures; clear it for any other status.
  const resolvedSeverity = status === 'FAIL' ? severity ?? null : null;

  const existing = await client.query(
    'SELECT updated_at FROM checklist_results WHERE id = $1',
    [id]
  );

  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO checklist_results
       (id, instance_id, template_item_id, status, severity, comments, photo_uri, created_at, updated_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [id, instance_id, template_item_id, status, resolvedSeverity, comments ?? null, photoUri, created_at, updated_at]
    );
  } else if (new Date(updated_at) > new Date(existing.rows[0].updated_at)) {
    await client.query(
      `UPDATE checklist_results
       SET status = $1, severity = $2, comments = $3, photo_uri = COALESCE($4, photo_uri), updated_at = $5, synced_at = NOW()
       WHERE id = $6`,
      [status, resolvedSeverity, comments ?? null, photoUri, updated_at, id]
    );
  }
}

async function upsertPunchItem(client: PoolClient, punchItem: any) {
  const { id, checklist_instance_id, template_item_id, description, status, created_at } =
    punchItem;

  const existing = await client.query('SELECT id FROM punch_items WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO punch_items
       (id, checklist_instance_id, template_item_id, description, status, created_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, checklist_instance_id, template_item_id, description, status ?? 'OPEN', created_at]
    );
  } else {
    await client.query(
      'UPDATE punch_items SET status = $1, synced_at = NOW() WHERE id = $2',
      [status ?? 'OPEN', id]
    );
  }
}

async function upsertChecklistInstance(client: PoolClient, instance: any) {
  const {
    id,
    project_id,
    template_id,
    inspector_name,
    status,
    created_at,
    signed_off_at,
    inspector_signature,
    pm_signature,
  } = instance;

  const existing = await client.query(
    'SELECT id FROM checklist_instances WHERE id = $1',
    [id]
  );
  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO checklist_instances
       (id, project_id, template_id, inspector_name, status, created_at, signed_off_at, inspector_signature, pm_signature, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [id, project_id, template_id, inspector_name, status, created_at, signed_off_at ?? null, inspector_signature ?? null, pm_signature ?? null]
    );
  } else {
    await client.query(
      `UPDATE checklist_instances
       SET status = $1, signed_off_at = $2, inspector_signature = $3, pm_signature = $4, synced_at = NOW()
       WHERE id = $5`,
      [status, signed_off_at ?? null, inspector_signature ?? null, pm_signature ?? null, id]
    );
  }
}

async function logSync(
  client: PoolClient,
  logData: { userId: string | null; resultCount: number; punchItemCount: number; payload: string }
) {
  await client.query(
    `INSERT INTO sync_log (user_id, action, payload, result_count, punch_item_count, synced_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [logData.userId, 'sync_completed', logData.payload, logData.resultCount, logData.punchItemCount]
  );
}

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Only listen when run directly (not when imported by tests).
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 QC Checklist API running on http://localhost:${port}`);
    console.log(`📝 Sync endpoint: POST http://localhost:${port}/api/sync`);
  });

  const shutdown = () => {
    console.log('\nShutting down gracefully...');
    pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
