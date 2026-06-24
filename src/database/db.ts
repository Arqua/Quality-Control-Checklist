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
  Severity,
  Alert,
  Activity,
  SafetyTip,
  IncidentCategory,
  IncidentReport,
  HotWorkPermit,
  RiggingForm,
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

    // Alerts table — serious (HIGH-severity) events surfaced to management.
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        result_id TEXT,
        project_id TEXT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        severity TEXT NOT NULL,
        acknowledged INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL
      );
    `);

    // Activity log table — team actions for audit trail and collaboration
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        instance_id TEXT,
        type TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (instance_id) REFERENCES checklist_instances(id) ON DELETE CASCADE
      );
    `);

    // Safety tips database
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS safety_tips (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_shown TEXT
      );
    `);

    // Incident reports
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS incident_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT,
        date_time TEXT NOT NULL,
        involved_parties TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN',
        reporter_name TEXT NOT NULL,
        corrective_actions TEXT,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `);

    // Incident attachments
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS incident_attachments (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        photo_local_uri TEXT NOT NULL,
        photo_remote_url TEXT,
        photo_sync_status TEXT DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        FOREIGN KEY (incident_id) REFERENCES incident_reports(id) ON DELETE CASCADE
      );
    `);

    // Hot work permits
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS hot_work_permits (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        permit_number TEXT NOT NULL,
        work_location TEXT NOT NULL,
        work_description TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        authorized_by TEXT NOT NULL,
        precautions_taken TEXT NOT NULL,
        equipment_list TEXT,
        responsible_person TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `);

    // Rigging forms
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS rigging_forms (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        rigging_number TEXT NOT NULL,
        load_description TEXT NOT NULL,
        load_weight REAL NOT NULL,
        rigging_plan TEXT NOT NULL,
        inspected_by TEXT NOT NULL,
        certification_number TEXT NOT NULL,
        weather_conditions TEXT,
        area_secured INTEGER NOT NULL DEFAULT 0,
        personnel_briefed INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `);

    // Apply migrations for databases created by older app versions.
    await runMigrations(database);

    // Sample data is inserted in development builds, or in any build that opts
    // in via EXPO_PUBLIC_SEED_DATA=true (used by the `preview` profile so the
    // offline test APK ships with projects/templates to inspect). Real
    // production builds leave this unset so seed data never reaches inspectors.
    if (__DEV__ || process.env.EXPO_PUBLIC_SEED_DATA === 'true') {
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
  await ensureColumn('checklist_results', 'severity', 'TEXT');
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

    // Seed initial safety tips
    const safetyTips = [
      {
        title: 'Always Wear Appropriate PPE',
        content: 'Personal protective equipment (PPE) is your first line of defense. Always wear the appropriate PPE for your work environment, including hard hats, safety glasses, gloves, and steel-toed boots. Ensure PPE fits properly and is in good condition.',
        category: 'PPE' as const,
      },
      {
        title: 'Be Aware of Your Surroundings',
        content: 'Maintain constant awareness of your work environment and potential hazards. Look for unexpected obstacles, unstable surfaces, or weather changes. Keep your phone secured and avoid distractions while working in hazardous areas.',
        category: 'HAZARD_AWARENESS' as const,
      },
      {
        title: 'Report Hazards Immediately',
        content: 'If you notice a hazard or unsafe condition, report it immediately to your supervisor. Do not attempt to fix hazardous situations yourself unless you are trained and authorized to do so. Documentation helps prevent future incidents.',
        category: 'HAZARD_AWARENESS' as const,
      },
      {
        title: 'Proper Ladder Safety',
        content: 'Always use a ladder on stable, level ground. Maintain three points of contact when climbing. Never lean too far to either side, and keep your hips within the ladder rails. Never use a damaged ladder.',
        category: 'BEST_PRACTICES' as const,
      },
      {
        title: 'Proper Lifting Techniques',
        content: 'Lift with your legs, not your back. Bend at the knees, keep the load close to your body, and avoid twisting. Ask for help with heavy items. Break down large loads into smaller, manageable quantities.',
        category: 'BEST_PRACTICES' as const,
      },
      {
        title: 'Hand Tool Safety',
        content: 'Use the right tool for the job. Inspect tools before use for damage. Keep tools in good condition with secure handles and sharp blades. Store tools properly in designated areas to prevent accidents.',
        category: 'BEST_PRACTICES' as const,
      },
      {
        title: 'Know Your Emergency Procedures',
        content: 'Familiarize yourself with emergency exits, assembly points, and emergency contact numbers. Know the location of first aid kits, fire extinguishers, and eyewash stations. Participate in safety drills and stay alert.',
        category: 'EMERGENCY_RESPONSE' as const,
      },
      {
        title: 'First Aid Response',
        content: 'If someone is injured, keep them calm and call for medical help immediately. Apply basic first aid if trained. Do not move seriously injured persons unless there is immediate danger. Ensure the area is safe before providing assistance.',
        category: 'EMERGENCY_RESPONSE' as const,
      },
    ];

    for (const tip of safetyTips) {
      const tipId = uuidv4();
      await database.runAsync(
        `INSERT INTO safety_tips (id, title, content, category, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [tipId, tip.title, tip.content, tip.category, new Date().toISOString()]
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

export const createTemplate = async (
  name: string,
  division: string
): Promise<Template> => {
  const database = await getDatabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO templates (id, name, division, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, name, division, createdAt]
  );

  return { id, name, division, created_at: createdAt };
};

export const createTemplateItem = async (
  templateId: string,
  descriptionText: string,
  sortOrder: number
): Promise<TemplateItem> => {
  const database = await getDatabase();
  const id = uuidv4();

  await database.runAsync(
    `INSERT INTO template_items (id, template_id, description_text, sort_order)
     VALUES (?, ?, ?, ?)`,
    [id, templateId, descriptionText, sortOrder]
  );

  return { id, template_id: templateId, description_text: descriptionText, sort_order: sortOrder };
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
  photoUri?: string,
  severity?: Severity | null
): Promise<ChecklistResult> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  const photoSyncStatus: PhotoSyncStatus = photoUri ? 'PENDING' : 'NONE';
  // Severity only applies to failures.
  const resolvedSeverity = status === 'FAIL' ? severity ?? null : null;

  await database.runAsync(
    `INSERT INTO checklist_results
     (id, instance_id, template_item_id, status, severity, comments, photo_local_uri, photo_remote_url, photo_sync_status, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, instanceId, templateItemId, status, resolvedSeverity, comments || null, photoUri || null, null, photoSyncStatus, 'PENDING', now, now]
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
    severity: resolvedSeverity,
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
  severity?: Severity | null;
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

  // Severity only applies to failures; a non-FAIL status clears it.
  let severity: Severity | null =
    patch.severity !== undefined ? patch.severity : existing.severity ?? null;
  if (status !== 'FAIL') {
    severity = null;
  }

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
     SET status = ?, severity = ?, comments = ?, photo_local_uri = ?, photo_remote_url = ?,
         photo_sync_status = ?, updated_at = ?, sync_status = ?
     WHERE id = ?`,
    [status, severity, comments, photoLocalUri, photoRemoteUrl, photoSyncStatus, now, 'PENDING', id]
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

export const updatePunchItemStatus = async (
  id: string,
  status: 'OPEN' | 'CLOSED'
): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE punch_items SET status = ?, sync_status = ? WHERE id = ?',
    [status, 'PENDING', id]
  );
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

// ALERTS CRUD — serious events surfaced to management.
export const createAlert = async (params: {
  instanceId: string;
  resultId?: string | null;
  projectId?: string | null;
  title: string;
  body: string;
  severity: Severity;
}): Promise<Alert> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO alerts
     (id, instance_id, result_id, project_id, title, body, severity, acknowledged, sync_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.instanceId,
      params.resultId ?? null,
      params.projectId ?? null,
      params.title,
      params.body,
      params.severity,
      0,
      'PENDING',
      now,
    ]
  );

  return {
    id,
    instance_id: params.instanceId,
    result_id: params.resultId ?? null,
    project_id: params.projectId ?? null,
    title: params.title,
    body: params.body,
    severity: params.severity,
    acknowledged: 0,
    sync_status: 'PENDING',
    created_at: now,
  };
};

export const getAlerts = async (): Promise<Alert[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Alert>(
    'SELECT * FROM alerts ORDER BY created_at DESC'
  );
  return rows || [];
};

export const getUnacknowledgedAlertCount = async (): Promise<number> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0'
  );
  return row?.count ?? 0;
};

export const acknowledgeAlert = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE alerts SET acknowledged = 1 WHERE id = ?',
    [id]
  );
};

/** Alerts raised on this device that have not yet been pushed to the backend. */
export const getPendingAlerts = async (): Promise<Alert[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Alert>(
    "SELECT * FROM alerts WHERE sync_status = 'PENDING' ORDER BY created_at ASC"
  );
  return rows || [];
};

/** Marks the given alerts as successfully synced to the backend. */
export const markAlertsSynced = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const database = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(
    `UPDATE alerts SET sync_status = 'SYNCED' WHERE id IN (${placeholders})`,
    ids
  );
};

/**
 * Stores an alert pulled from the backend (raised on another device). Returns
 * true when the alert is new to this device so callers can surface a local
 * notification. Existing rows only have their acknowledged flag reconciled.
 */
export const upsertServerAlert = async (a: {
  id: string;
  instance_id: string;
  result_id?: string | null;
  project_id?: string | null;
  title: string;
  body: string;
  severity: Severity;
  acknowledged?: boolean | number;
  created_at: string;
}): Promise<boolean> => {
  const database = await getDatabase();
  const ack = a.acknowledged ? 1 : 0;
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM alerts WHERE id = ?',
    [a.id]
  );

  if (existing) {
    await database.runAsync('UPDATE alerts SET acknowledged = ? WHERE id = ?', [ack, a.id]);
    return false;
  }

  await database.runAsync(
    `INSERT INTO alerts
     (id, instance_id, result_id, project_id, title, body, severity, acknowledged, sync_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)`,
    [
      a.id,
      a.instance_id,
      a.result_id ?? null,
      a.project_id ?? null,
      a.title,
      a.body,
      a.severity,
      ack,
      a.created_at,
    ]
  );
  return true;
};

// ACTIVITY LOG — team collaboration and audit trail
export const createActivity = async (params: {
  projectId: string;
  instanceId?: string | null;
  type: 'CHECKLIST_COMPLETED' | 'SEVERITY_FLAGGED' | 'PUNCH_ITEM_CLOSED' | 'NOTE_ADDED';
  actorName: string;
  description: string;
  severity?: Severity | null;
}): Promise<Activity> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO activities
     (id, project_id, instance_id, type, actor_name, description, severity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.projectId,
      params.instanceId ?? null,
      params.type,
      params.actorName,
      params.description,
      params.severity ?? null,
      now,
    ]
  );

  return {
    id,
    project_id: params.projectId,
    instance_id: params.instanceId ?? null,
    type: params.type,
    actor_name: params.actorName,
    description: params.description,
    severity: params.severity ?? null,
    created_at: now,
  };
};

export const getActivitiesByProject = async (
  projectId: string,
  limit: number = 50
): Promise<Activity[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Activity>(
    'SELECT * FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT ?',
    [projectId, limit]
  );
  return rows || [];
};

export const getRecentActivities = async (limit: number = 20): Promise<Activity[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Activity>(
    'SELECT * FROM activities ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows || [];
};

// SAFETY TIPS — Workplace safety education
export const getDailyTip = async (): Promise<SafetyTip | null> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<SafetyTip>(
    `SELECT * FROM safety_tips
     WHERE last_shown IS NULL OR date(last_shown) != date('now')
     ORDER BY RANDOM() LIMIT 1`
  );

  if (row) {
    await database.runAsync(
      'UPDATE safety_tips SET last_shown = ? WHERE id = ?',
      [new Date().toISOString(), row.id]
    );
  }

  return row || null;
};

export const getAllTips = async (): Promise<SafetyTip[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<SafetyTip>(
    'SELECT * FROM safety_tips ORDER BY created_at DESC'
  );
  return rows || [];
};

export const createSafetyTip = async (params: {
  title: string;
  content: string;
  category: SafetyTip['category'];
}): Promise<SafetyTip> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO safety_tips (id, title, content, category, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, params.title, params.content, params.category, now]
  );

  return {
    id,
    title: params.title,
    content: params.content,
    category: params.category,
    created_at: now,
  };
};

// INCIDENT REPORTS — Workplace incident tracking
export const createIncidentReport = async (params: {
  projectId: string;
  category: IncidentCategory;
  severity: Severity;
  description: string;
  location?: string | null;
  dateTime: string;
  involvedParties?: string | null;
  reporterName: string;
  correctiveActions?: string | null;
}): Promise<IncidentReport> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO incident_reports
     (id, project_id, category, severity, description, location, date_time, involved_parties, status, reporter_name, corrective_actions, sync_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.projectId,
      params.category,
      params.severity,
      params.description,
      params.location ?? null,
      params.dateTime,
      params.involvedParties ?? null,
      'OPEN',
      params.reporterName,
      params.correctiveActions ?? null,
      'PENDING',
      now,
      now,
    ]
  );

  return {
    id,
    project_id: params.projectId,
    category: params.category,
    severity: params.severity,
    description: params.description,
    location: params.location ?? null,
    date_time: params.dateTime,
    involved_parties: params.involvedParties ?? null,
    status: 'OPEN',
    reporter_name: params.reporterName,
    corrective_actions: params.correctiveActions ?? null,
    sync_status: 'PENDING',
    created_at: now,
    updated_at: now,
  };
};

export const getIncidentReportsByProject = async (
  projectId: string
): Promise<IncidentReport[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<IncidentReport>(
    'SELECT * FROM incident_reports WHERE project_id = ? ORDER BY date_time DESC',
    [projectId]
  );
  return rows || [];
};

export const getIncidentReportById = async (id: string): Promise<IncidentReport | null> => {
  const database = await getDatabase();
  return (
    (await database.getFirstAsync<IncidentReport>(
      'SELECT * FROM incident_reports WHERE id = ?',
      [id]
    )) || null
  );
};

export const updateIncidentReportStatus = async (
  id: string,
  status: IncidentReport['status']
): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE incident_reports SET status = ?, sync_status = ?, updated_at = ? WHERE id = ?',
    [status, 'PENDING', now, id]
  );
};

export const getHighSeverityIncidents = async (): Promise<IncidentReport[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<IncidentReport>(
    `SELECT * FROM incident_reports
     WHERE severity = 'HIGH' AND status = 'OPEN'
     ORDER BY date_time DESC`
  );
  return rows || [];
};

// HOT WORK PERMITS — Fire-related work activity tracking
export const createHotWorkPermit = async (params: {
  projectId: string;
  permitNumber: string;
  workLocation: string;
  workDescription: string;
  startDate: string;
  endDate: string;
  authorizedBy: string;
  precautionsTaken: string;
  equipmentList?: string | null;
  responsiblePerson: string;
}): Promise<HotWorkPermit> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO hot_work_permits
     (id, project_id, permit_number, work_location, work_description, start_date, end_date, authorized_by, precautions_taken, equipment_list, responsible_person, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.projectId,
      params.permitNumber,
      params.workLocation,
      params.workDescription,
      params.startDate,
      params.endDate,
      params.authorizedBy,
      params.precautionsTaken,
      params.equipmentList ?? null,
      params.responsiblePerson,
      'ACTIVE',
      now,
      now,
    ]
  );

  return {
    id,
    project_id: params.projectId,
    permit_number: params.permitNumber,
    work_location: params.workLocation,
    work_description: params.workDescription,
    start_date: params.startDate,
    end_date: params.endDate,
    authorized_by: params.authorizedBy,
    precautions_taken: params.precautionsTaken,
    equipment_list: params.equipmentList ?? null,
    responsible_person: params.responsiblePerson,
    status: 'ACTIVE',
    created_at: now,
    updated_at: now,
  };
};

export const getHotWorkPermitsByProject = async (
  projectId: string
): Promise<HotWorkPermit[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<HotWorkPermit>(
    'SELECT * FROM hot_work_permits WHERE project_id = ? ORDER BY start_date DESC',
    [projectId]
  );
  return rows || [];
};

export const updateHotWorkPermitStatus = async (
  id: string,
  status: HotWorkPermit['status']
): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE hot_work_permits SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, id]
  );
};

// RIGGING FORMS — Heavy lifting operation tracking
export const createRiggingForm = async (params: {
  projectId: string;
  riggingNumber: string;
  loadDescription: string;
  loadWeight: number;
  riggingPlan: string;
  inspectedBy: string;
  certificationNumber: string;
  weatherConditions?: string | null;
  areaSecured: boolean;
  personnelBriefed: boolean;
}): Promise<RiggingForm> => {
  const database = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO rigging_forms
     (id, project_id, rigging_number, load_description, load_weight, rigging_plan, inspected_by, certification_number, weather_conditions, area_secured, personnel_briefed, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.projectId,
      params.riggingNumber,
      params.loadDescription,
      params.loadWeight,
      params.riggingPlan,
      params.inspectedBy,
      params.certificationNumber,
      params.weatherConditions ?? null,
      params.areaSecured ? 1 : 0,
      params.personnelBriefed ? 1 : 0,
      'PENDING',
      now,
      now,
    ]
  );

  return {
    id,
    project_id: params.projectId,
    rigging_number: params.riggingNumber,
    load_description: params.loadDescription,
    load_weight: params.loadWeight,
    rigging_plan: params.riggingPlan,
    inspected_by: params.inspectedBy,
    certification_number: params.certificationNumber,
    weather_conditions: params.weatherConditions ?? null,
    area_secured: params.areaSecured,
    personnel_briefed: params.personnelBriefed,
    status: 'PENDING',
    created_at: now,
    updated_at: now,
  };
};

export const getRiggingFormsByProject = async (
  projectId: string
): Promise<RiggingForm[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<RiggingForm>(
    'SELECT * FROM rigging_forms WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
  return rows?.map(row => ({
    ...row,
    area_secured: Boolean(row.area_secured),
    personnel_briefed: Boolean(row.personnel_briefed),
  })) || [];
};

export const updateRiggingFormStatus = async (
  id: string,
  status: RiggingForm['status']
): Promise<void> => {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE rigging_forms SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, id]
  );
};
