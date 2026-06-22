import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import {
  Project,
  Template,
  TemplateItem,
  ChecklistInstance,
  ChecklistResult,
  PunchItem,
  ItemStatus,
  ChecklistStatus,
  PhotoSyncStatus,
  SyncPayload,
} from '../types/database';

const DB_NAME = 'qc-checklist.db';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeDatabase(db);
  return db;
};

const initializeDatabase = async (database: SQLite.SQLiteDatabase) => {
  try {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);

    // Projects table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Templates table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        division TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Template items table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS template_items (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        description_text TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
      );
    `);

    // Checklist instances table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS checklist_instances (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        inspector_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        signed_off_at TEXT,
        inspector_signature TEXT,
        pm_signature TEXT,
        sync_status TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (template_id) REFERENCES templates(id)
      );
    `);

    // Checklist results table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS checklist_results (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        template_item_id TEXT NOT NULL,
        status TEXT NOT NULL,
        comments TEXT,
        photo_local_uri TEXT,
        photo_remote_url TEXT,
        photo_sync_status TEXT NOT NULL DEFAULT 'NONE',
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (instance_id) REFERENCES checklist_instances(id) ON DELETE CASCADE,
        FOREIGN KEY (template_item_id) REFERENCES template_items(id)
      );
    `);

    // Punch items table
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS punch_items (
        id TEXT PRIMARY KEY,
        checklist_instance_id TEXT NOT NULL,
        template_item_id TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        FOREIGN KEY (checklist_instance_id) REFERENCES checklist_instances(id) ON DELETE CASCADE,
        FOREIGN KEY (template_item_id) REFERENCES template_items(id)
      );
    `);

    // Apply migrations for databases created by older app versions.
    await runMigrations(database);

    // Sample data is only inserted in development builds. Shipping seed data
    // in a production/release binary would pollute real inspectors' devices.
    if (__DEV__) {
      await seedDatabase(database);
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

/**
 * Idempotently adds columns introduced after the initial release so existing
 * installs upgrade cleanly. SQLite has no "ADD COLUMN IF NOT EXISTS", so we
 * inspect the table schema first and only ALTER when the column is missing.
 */
const runMigrations = async (database: SQLite.SQLiteDatabase) => {
  const ensureColumn = async (
    table: string,
    column: string,
    definition: string
  ) => {
    const cols = await database.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${table})`
    );
    const exists = (cols || []).some((c) => c.name === column);
    if (!exists) {
      await database.execAsync(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`
      );
    }
  };

  await ensureColumn('checklist_results', 'photo_remote_url', 'TEXT');
  await ensureColumn(
    'checklist_results',
    'photo_sync_status',
    "TEXT NOT NULL DEFAULT 'NONE'"
  );
  await ensureColumn('checklist_instances', 'sync_status', 'TEXT');
};

const seedDatabase = async (database: SQLite.SQLiteDatabase) => {
  try {
    // Check if templates already exist
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM templates'
    );

    if (result && result.count > 0) {
      return; // Already seeded
    }

    // Create sample project
    const projectId = uuidv4();
    await database.runAsync(
      `INSERT INTO projects (id, name, location, created_at)
       VALUES (?, ?, ?, ?)`,
      [projectId, 'Downtown Office Tower', 'Block A - 123 Main St', new Date().toISOString()]
    );

    // Create Concrete Pouring template
    const templateId = uuidv4();
    await database.runAsync(
      `INSERT INTO templates (id, name, division, created_at)
       VALUES (?, ?, ?, ?)`,
      [templateId, 'Pre-Pour Concrete', 'Concrete Pouring', new Date().toISOString()]
    );

    // Concrete Pouring checklist items
    const items = [
      { description: 'Subgrade compaction verified and meets specifications', order: 1 },
      { description: 'Formwork alignment checked - level and plumb within tolerances', order: 2 },
      { description: 'Rebar spacing and clearance confirmed per plans', order: 3 },
      { description: 'Slump test log recorded and within range', order: 4 },
      { description: 'Curing compound application verified', order: 5 },
    ];

    for (const item of items) {
      const itemId = uuidv4();
      await database.runAsync(
        `INSERT INTO template_items (id, template_id, description_text, sort_order)
         VALUES (?, ?, ?, ?)`,
        [itemId, templateId, item.description, item.order]
      );
    }
  } catch (error) {
    console.error('Seeding error:', error);
  }
};

// PROJECT CRUD
export const getAllProjects = async (): Promise<Project[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<Project>(
    'SELECT * FROM projects ORDER BY created_at DESC'
  );
  return result || [];
};

export const getProjectById = async (id: string): Promise<Project | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Project>(
    'SELECT * FROM projects WHERE id = ?',
    [id]
  );
  return result || null;
};

export const createProject = async (name: string, location: string): Promise<Project> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO projects (id, name, location, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, name, location, now]
  );

  return { id, name, location, created_at: now };
};

// TEMPLATE CRUD
export const getAllTemplates = async (): Promise<Template[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<Template>(
    'SELECT * FROM templates ORDER BY division, name'
  );
  return result || [];
};

export const getTemplateById = async (id: string): Promise<Template | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Template>(
    'SELECT * FROM templates WHERE id = ?',
    [id]
  );
  return result || null;
};

export const getTemplateItemsByTemplate = async (templateId: string): Promise<TemplateItem[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<TemplateItem>(
    'SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order',
    [templateId]
  );
  return result || [];
};

// CHECKLIST INSTANCE CRUD
export const createChecklistInstance = async (
  projectId: string,
  templateId: string,
  inspectorName: string
): Promise<ChecklistInstance> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO checklist_instances (id, project_id, template_id, inspector_name, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, projectId, templateId, inspectorName, 'DRAFT', now]
  );

  return {
    id,
    project_id: projectId,
    template_id: templateId,
    inspector_name: inspectorName,
    status: 'DRAFT',
    created_at: now,
  };
};

export const getChecklistInstancesByProject = async (projectId: string): Promise<ChecklistInstance[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<ChecklistInstance>(
    'SELECT * FROM checklist_instances WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
  return result || [];
};

export const getChecklistInstanceById = async (id: string): Promise<ChecklistInstance | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<ChecklistInstance>(
    'SELECT * FROM checklist_instances WHERE id = ?',
    [id]
  );
  return result || null;
};

export const updateChecklistInstanceStatus = async (
  id: string,
  status: ChecklistStatus
): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE checklist_instances SET status = ? WHERE id = ?',
    [status, id]
  );
};

export const signOffChecklistInstance = async (
  id: string,
  inspectorSignature: string,
  pmSignature?: string
): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.runAsync(
    `UPDATE checklist_instances
     SET status = ?, signed_off_at = ?, inspector_signature = ?, pm_signature = ?
     WHERE id = ?`,
    [
      'COMPLETED',
      now,
      inspectorSignature,
      pmSignature || null,
      id,
    ]
  );
};

// CHECKLIST RESULTS CRUD
export const createChecklistResult = async (
  instanceId: string,
  templateItemId: string,
  status: ItemStatus,
  comments?: string,
  photoUri?: string
): Promise<ChecklistResult> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  const photoSyncStatus: PhotoSyncStatus = photoUri ? 'PENDING' : 'NONE';

  await database.runAsync(
    `INSERT INTO checklist_results
     (id, instance_id, template_item_id, status, comments, photo_local_uri, photo_remote_url, photo_sync_status, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, instanceId, templateItemId, status, comments || null, photoUri || null, null, photoSyncStatus, 'PENDING', now, now]
  );

  // If FAIL, create punch item
  if (status === 'FAIL') {
    const item = await database.getFirstAsync<TemplateItem>(
      'SELECT description_text FROM template_items WHERE id = ?',
      [templateItemId]
    );
    if (item) {
      await createPunchItem(instanceId, templateItemId, `Failed: ${item.description_text}`);
    }
  }

  return {
    id,
    instance_id: instanceId,
    template_item_id: templateItemId,
    status,
    comments: comments || null,
    photo_local_uri: photoUri || null,
    photo_remote_url: null,
    photo_sync_status: photoSyncStatus,
    sync_status: 'PENDING',
    created_at: now,
    updated_at: now,
  };
};

/**
 * Patch shape for partial updates. A field left `undefined` is preserved; an
 * explicit `null` for `photoUri` clears the attached photo.
 */
export interface ChecklistResultPatch {
  status?: ItemStatus;
  comments?: string | null;
  photoUri?: string | null;
}

export const updateChecklistResult = async (
  id: string,
  patch: ChecklistResultPatch
): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();

  const existing = await database.getFirstAsync<ChecklistResult>(
    'SELECT * FROM checklist_results WHERE id = ?',
    [id]
  );

  if (!existing) {
    throw new Error('Checklist result not found');
  }

  // Merge: only overwrite fields explicitly provided in the patch.
  const status = patch.status ?? existing.status;
  const comments =
    patch.comments !== undefined ? patch.comments : existing.comments ?? null;

  let photoLocalUri = existing.photo_local_uri ?? null;
  let photoRemoteUrl = existing.photo_remote_url ?? null;
  let photoSyncStatus: PhotoSyncStatus = existing.photo_sync_status ?? 'NONE';

  if (patch.photoUri !== undefined) {
    photoLocalUri = patch.photoUri;
    // A new (or cleared) local photo invalidates any prior upload.
    photoRemoteUrl = null;
    photoSyncStatus = patch.photoUri ? 'PENDING' : 'NONE';
  }

  await database.runAsync(
    `UPDATE checklist_results
     SET status = ?, comments = ?, photo_local_uri = ?, photo_remote_url = ?,
         photo_sync_status = ?, updated_at = ?, sync_status = ?
     WHERE id = ?`,
    [status, comments, photoLocalUri, photoRemoteUrl, photoSyncStatus, now, 'PENDING', id]
  );

  // If changing to FAIL and wasn't before, create punch item
  if (status === 'FAIL' && existing.status !== 'FAIL') {
    const item = await database.getFirstAsync<TemplateItem>(
      'SELECT description_text FROM template_items WHERE id = ?',
      [existing.template_item_id]
    );
    if (item) {
      await createPunchItem(existing.instance_id, existing.template_item_id, `Failed: ${item.description_text}`);
    }
  }
};

export const getChecklistResultsByInstance = async (instanceId: string): Promise<ChecklistResult[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<ChecklistResult>(
    'SELECT * FROM checklist_results WHERE instance_id = ? ORDER BY created_at',
    [instanceId]
  );
  return result || [];
};

export const getChecklistResultById = async (id: string): Promise<ChecklistResult | null> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<ChecklistResult>(
    'SELECT * FROM checklist_results WHERE id = ?',
    [id]
  );
  return result || null;
};

// PUNCH ITEMS CRUD
export const createPunchItem = async (
  checklistInstanceId: string,
  templateItemId: string,
  description: string
): Promise<PunchItem> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO punch_items
     (id, checklist_instance_id, template_item_id, description, status, sync_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, checklistInstanceId, templateItemId, description, 'OPEN', 'PENDING', now]
  );

  return {
    id,
    checklist_instance_id: checklistInstanceId,
    template_item_id: templateItemId,
    description,
    status: 'OPEN',
    sync_status: 'PENDING',
    created_at: now,
  };
};

export const getPunchItemsByInstance = async (instanceId: string): Promise<PunchItem[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<PunchItem>(
    'SELECT * FROM punch_items WHERE checklist_instance_id = ? ORDER BY created_at DESC',
    [instanceId]
  );
  return result || [];
};

// SYNC FUNCTIONS
export const getPendingSyncPayload = async (): Promise<SyncPayload> => {
  const database = await getDatabase();

  const results = await database.getAllAsync<ChecklistResult>(
    'SELECT * FROM checklist_results WHERE sync_status = ? ORDER BY updated_at',
    ['PENDING']
  );

  const punchItems = await database.getAllAsync<PunchItem>(
    'SELECT * FROM punch_items WHERE sync_status = ? ORDER BY created_at',
    ['PENDING']
  );

  const instances = await database.getAllAsync<ChecklistInstance>(
    "SELECT * FROM checklist_instances WHERE status = ? AND (sync_status IS NULL OR sync_status = 'PENDING') LIMIT 100",
    ['COMPLETED']
  );

  return {
    results: results || [],
    punchItems: punchItems || [],
    instances: instances || [],
    timestamp: new Date().toISOString(),
  };
};

/**
 * Returns results whose photo still needs to be uploaded to remote storage.
 * The mobile sync layer uploads these first, then records the remote URL.
 */
export const getPendingPhotoUploads = async (): Promise<ChecklistResult[]> => {
  const database = await getDatabase();
  const result = await database.getAllAsync<ChecklistResult>(
    `SELECT * FROM checklist_results
     WHERE photo_sync_status = ? AND photo_local_uri IS NOT NULL
     ORDER BY updated_at`,
    ['PENDING']
  );
  return result || [];
};

/**
 * Records that a result's photo has been uploaded to object storage.
 * Marks the photo as UPLOADED and re-flags the row for metadata sync so the
 * remote URL is propagated to the backend.
 */
export const markPhotoUploaded = async (
  resultId: string,
  remoteUrl: string
): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE checklist_results
     SET photo_remote_url = ?, photo_sync_status = ?, sync_status = ?
     WHERE id = ?`,
    [remoteUrl, 'UPLOADED', 'PENDING', resultId]
  );
};

export const markAsSynced = async (
  resultIds: string[],
  punchItemIds: string[],
  instanceIds: string[]
): Promise<void> => {
  const database = await getDatabase();

  if (resultIds.length > 0) {
    const placeholders = resultIds.map(() => '?').join(',');
    await database.runAsync(
      `UPDATE checklist_results SET sync_status = ? WHERE id IN (${placeholders})`,
      ['SYNCED', ...resultIds]
    );
  }

  if (punchItemIds.length > 0) {
    const placeholders = punchItemIds.map(() => '?').join(',');
    await database.runAsync(
      `UPDATE punch_items SET sync_status = ? WHERE id IN (${placeholders})`,
      ['SYNCED', ...punchItemIds]
    );
  }

  if (instanceIds.length > 0) {
    const placeholders = instanceIds.map(() => '?').join(',');
    await database.runAsync(
      `UPDATE checklist_instances SET sync_status = ? WHERE id IN (${placeholders})`,
      ['SYNCED', ...instanceIds]
    );
  }
};
