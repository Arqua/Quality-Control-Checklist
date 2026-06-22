import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { Pool, PoolClient } from 'pg';
import { authenticateToken, canAccessProject } from './auth';
import {
  validateSyncPayload,
  collectInstanceIds,
} from './validation';
import { storePhoto } from './storage';

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
    console.error('[SYNC ERROR]', error);
    return res.status(500).json({
      success: false,
      error: 'Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
    });
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
  if (!resultId) {
    return res.status(400).json({ success: false, error: 'resultId is required' });
  }

  const client = await pool.connect();
  try {
    // Authorize against the photo's owning project, if the result exists.
    const { rows } = await client.query(
      `SELECT ci.project_id AS project_id
         FROM checklist_results cr
         JOIN checklist_instances ci ON ci.id = cr.instance_id
        WHERE cr.id = $1`,
      [resultId]
    );
    if (rows.length > 0 && !canAccessProject(req.user, rows[0].project_id)) {
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

async function upsertChecklistResult(client: PoolClient, result: any) {
  const {
    id,
    instance_id,
    template_item_id,
    status,
    comments,
    photo_remote_url,
    photo_local_uri,
    created_at,
    updated_at,
  } = result;

  // Prefer the uploaded remote URL; fall back to whatever URI the client sent.
  const photoUri = photo_remote_url ?? photo_local_uri ?? null;

  const existing = await client.query(
    'SELECT updated_at FROM checklist_results WHERE id = $1',
    [id]
  );

  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO checklist_results
       (id, instance_id, template_item_id, status, comments, photo_uri, created_at, updated_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [id, instance_id, template_item_id, status, comments ?? null, photoUri, created_at, updated_at]
    );
  } else if (new Date(updated_at) > new Date(existing.rows[0].updated_at)) {
    await client.query(
      `UPDATE checklist_results
       SET status = $1, comments = $2, photo_uri = COALESCE($3, photo_uri), updated_at = $4, synced_at = NOW()
       WHERE id = $5`,
      [status, comments ?? null, photoUri, updated_at, id]
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
