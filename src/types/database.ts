export type ItemStatus = 'PASS' | 'FAIL' | 'NA';
export type ChecklistStatus = 'DRAFT' | 'COMPLETED';
export type SyncStatus = 'PENDING' | 'SYNCED';

/**
 * Severity classification for a failed inspection item. HIGH-severity failures
 * are "serious events" that raise an {@link Alert} and notify management.
 */
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Tracks the lifecycle of a photo attachment as it moves from the device's
 * local filesystem up to remote object storage (e.g. an S3 bucket).
 * - NONE:     no photo attached to this result
 * - PENDING:  photo captured locally, not yet uploaded
 * - UPLOADED: photo uploaded; `photo_remote_url` is populated
 */
export type PhotoSyncStatus = 'NONE' | 'PENDING' | 'UPLOADED';

export interface Project {
  id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  division: string;
  created_at: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  description_text: string;
  sort_order: number;
}

export interface ChecklistInstance {
  id: string;
  project_id: string;
  template_id: string;
  inspector_name: string;
  status: ChecklistStatus;
  created_at: string;
  signed_off_at?: string | null;
  inspector_signature?: string | null;
  pm_signature?: string | null;
  sync_status?: SyncStatus | null;
}

export interface ChecklistResult {
  id: string;
  instance_id: string;
  template_item_id: string;
  status: ItemStatus;
  /** Risk severity, set when an item is marked FAIL. Null otherwise. */
  severity?: Severity | null;
  comments?: string | null;
  /** Local file:// URI of the captured/selected photo on the device. */
  photo_local_uri?: string | null;
  /** Remote object-storage URL once the photo has been uploaded. */
  photo_remote_url?: string | null;
  /** Upload lifecycle for the attached photo. */
  photo_sync_status: PhotoSyncStatus;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface PunchItem {
  id: string;
  checklist_instance_id: string;
  template_item_id: string;
  description: string;
  status: 'OPEN' | 'CLOSED';
  sync_status: SyncStatus;
  created_at: string;
}

/**
 * A management alert raised when a serious (HIGH-severity) event is registered
 * during an inspection. Surfaced in the manager-only alerts inbox and, on the
 * device that recorded it, via a local push notification. When a backend is
 * configured, alerts sync up so other managers' devices can be push-notified.
 */
export interface Alert {
  id: string;
  instance_id: string;
  result_id: string | null;
  project_id: string | null;
  title: string;
  body: string;
  severity: Severity;
  /** 0 = unread/unacknowledged, 1 = acknowledged by a manager. */
  acknowledged: number;
  sync_status: SyncStatus;
  created_at: string;
}

/**
 * Activity log entry tracking team actions for collaboration and audit trail.
 */
export interface Activity {
  id: string;
  project_id: string;
  instance_id?: string | null;
  type: 'CHECKLIST_COMPLETED' | 'SEVERITY_FLAGGED' | 'PUNCH_ITEM_CLOSED' | 'NOTE_ADDED';
  actor_name: string;
  description: string;
  severity?: Severity | null;
  created_at: string;
}

/**
 * Safety tip for daily safety education.
 */
export interface SafetyTip {
  id: string;
  title: string;
  content: string;
  category: 'PPE' | 'HAZARD_AWARENESS' | 'BEST_PRACTICES' | 'EMERGENCY_RESPONSE';
  created_at: string;
  last_shown?: string | null;
}

/**
 * Workplace incident report categories.
 */
export type IncidentCategory =
  | 'INJURY_ILLNESS'
  | 'MOTOR_VEHICLE'
  | 'PROPERTY_DAMAGE'
  | 'ENVIRONMENTAL_SPILL'
  | 'LINE_STRIKE'
  | 'NEAR_MISS';

/**
 * Workplace incident report with severity classification for management alerts.
 */
export interface IncidentReport {
  id: string;
  project_id: string;
  category: IncidentCategory;
  severity: Severity;
  description: string;
  location?: string | null;
  date_time: string;
  involved_parties?: string | null;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
  reporter_name: string;
  corrective_actions?: string | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Incident photo attachment.
 */
export interface IncidentAttachment {
  id: string;
  incident_id: string;
  photo_local_uri: string;
  photo_remote_url?: string | null;
  photo_sync_status: PhotoSyncStatus;
  created_at: string;
}

/**
 * Hot work permit for tracking fire-related work activities.
 */
export interface HotWorkPermit {
  id: string;
  project_id: string;
  permit_number: string;
  work_location: string;
  work_description: string;
  start_date: string;
  end_date: string;
  authorized_by: string;
  precautions_taken: string;
  equipment_list?: string | null;
  responsible_person: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

/**
 * Rigging form for tracking heavy lifting operations.
 */
export interface RiggingForm {
  id: string;
  project_id: string;
  rigging_number: string;
  load_description: string;
  load_weight: number;
  rigging_plan: string;
  inspected_by: string;
  certification_number: string;
  weather_conditions?: string | null;
  area_secured: boolean;
  personnel_briefed: boolean;
  status: 'PENDING' | 'APPROVED' | 'IN_USE' | 'COMPLETED' | 'REJECTED';
  created_at: string;
  updated_at: string;
}

/**
 * Equipment inspection for heavy machinery readiness assessment.
 */
export interface EquipmentInspection {
  id: string;
  project_id: string;
  equipment_number: string;
  equipment_type: string;
  photo_uri?: string | null;
  inspector_name: string;
  inspection_status: 'PASS' | 'FAIL' | 'NEEDS_REPAIR';
  engine_condition?: boolean | null;
  hydraulic_systems?: boolean | null;
  tires_tracks?: boolean | null;
  lights_mirrors?: boolean | null;
  safety_devices?: boolean | null;
  fluid_levels?: boolean | null;
  structural_integrity?: boolean | null;
  operator_controls?: boolean | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Pre-job safety briefing completed before work begins.
 */
export interface PreJobBriefing {
  id: string;
  project_id: string;
  job_description: string;
  work_location: string;
  supervisor: string;
  crew_members: string;
  identified_hazards: string;
  control_measures: string;
  ppe_required: string;
  emergency_procedures?: string | null;
  status: 'OPEN' | 'COMPLETED';
  created_at: string;
  updated_at: string;
}

export interface SyncPayload {
  results: ChecklistResult[];
  punchItems: PunchItem[];
  instances: ChecklistInstance[];
  timestamp: string;
}
