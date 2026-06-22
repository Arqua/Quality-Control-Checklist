import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// TODO: Implement authentication middleware
// app.use('/api/*', authenticateToken);

/**
 * POST /api/sync
 * Main sync endpoint for offline-first data synchronization
 *
 * Receives:
 * - checklist_results: Array of inspection item results
 * - punch_items: Array of auto-generated defect items
 * - instances: Array of completed checklists
 *
 * Returns:
 * - synced IDs from successful upserts
 */
app.post('/api/sync', async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { results = [], punchItems = [], instances = [], timestamp } = req.body;

    console.log(`[SYNC] Processing payload: ${results.length} results, ${punchItems.length} punch items, ${instances.length} instances`);

    // Validate payload
    if (!Array.isArray(results) || !Array.isArray(punchItems) || !Array.isArray(instances)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload structure',
      });
    }

    // TODO: Validate data integrity and user permissions

    const syncedIds = {
      resultIds: [] as string[],
      punchItemIds: [] as string[],
      instanceIds: [] as string[],
    };

    // Begin transaction
    await client.query('BEGIN');

    try {
      // Process checklist results
      for (const result of results) {
        await upsertChecklistResult(client, result);
        syncedIds.resultIds.push(result.id);
      }

      // Process punch items
      for (const punchItem of punchItems) {
        await upsertPunchItem(client, punchItem);
        syncedIds.punchItemIds.push(punchItem.id);
      }

      // Process instances
      for (const instance of instances) {
        await upsertChecklistInstance(client, instance);
        syncedIds.instanceIds.push(instance.id);
      }

      // Log sync operation
      await logSync(client, {
        action: 'sync_completed',
        resultCount: results.length,
        punchItemCount: punchItems.length,
        instanceCount: instances.length,
        payload: JSON.stringify({ results, punchItems, instances }),
      });

      await client.query('COMMIT');

      res.json({
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
    res.status(500).json({
      success: false,
      error: 'Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
    });
  } finally {
    client.release();
  }
});

/**
 * Upsert checklist result with conflict resolution
 * Uses updated_at timestamp to determine which version to keep
 */
async function upsertChecklistResult(client: any, result: any) {
  const {
    id,
    instance_id,
    template_item_id,
    status,
    comments,
    photo_local_uri,
    created_at,
    updated_at,
  } = result;

  // Check if result exists
  const existing = await client.query(
    'SELECT updated_at FROM checklist_results WHERE id = $1',
    [id]
  );

  if (existing.rows.length === 0) {
    // Insert new
    await client.query(
      `INSERT INTO checklist_results
       (id, instance_id, template_item_id, status, comments, photo_uri, created_at, updated_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [id, instance_id, template_item_id, status, comments, photo_local_uri, created_at, updated_at]
    );
  } else {
    // Update if client version is newer (conflict resolution)
    const existingTime = new Date(existing.rows[0].updated_at);
    const incomingTime = new Date(updated_at);

    if (incomingTime > existingTime) {
      await client.query(
        `UPDATE checklist_results
         SET status = $1, comments = $2, photo_uri = $3, updated_at = $4, synced_at = NOW()
         WHERE id = $5`,
        [status, comments, photo_local_uri, updated_at, id]
      );
    }
    // else: server version is newer, ignore update
  }
}

/**
 * Upsert punch item
 */
async function upsertPunchItem(client: any, punchItem: any) {
  const {
    id,
    checklist_instance_id,
    template_item_id,
    description,
    status,
    created_at,
  } = punchItem;

  const existing = await client.query(
    'SELECT id FROM punch_items WHERE id = $1',
    [id]
  );

  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO punch_items
       (id, checklist_instance_id, template_item_id, description, status, created_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, checklist_instance_id, template_item_id, description, status, created_at]
    );
  } else {
    // Update status if changed
    await client.query(
      'UPDATE punch_items SET status = $1, synced_at = NOW() WHERE id = $2',
      [status, id]
    );
  }
}

/**
 * Upsert checklist instance
 */
async function upsertChecklistInstance(client: any, instance: any) {
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
      [id, project_id, template_id, inspector_name, status, created_at, signed_off_at, inspector_signature, pm_signature]
    );
  } else {
    // Update only if status changed (e.g., from DRAFT to COMPLETED)
    await client.query(
      `UPDATE checklist_instances
       SET status = $1, signed_off_at = $2, inspector_signature = $3, pm_signature = $4, synced_at = NOW()
       WHERE id = $5`,
      [status, signed_off_at, inspector_signature, pm_signature, id]
    );
  }
}

/**
 * Log sync operation for audit trail
 */
async function logSync(client: any, logData: any) {
  const { action, resultCount, punchItemCount, instanceCount, payload } = logData;

  await client.query(
    `INSERT INTO sync_log (action, payload, result_count, punch_item_count, synced_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [action, payload, resultCount, punchItemCount]
  );
}

// TODO: Implement additional endpoints
// GET /api/projects - List all projects
// GET /api/templates - List all templates
// GET /api/checklists/:projectId - List checklists for project
// GET /api/punch-items/:instanceId - List punch items
// PATCH /api/punch-items/:id - Update punch item status
// POST /api/photos - Upload and store photos
// GET /api/reports/:instanceId - Generate PDF report

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 QC Checklist API running on http://localhost:${port}`);
  console.log(`📝 Sync endpoint: POST http://localhost:${port}/api/sync`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  pool.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  pool.end();
  process.exit(0);
});

export default app;
