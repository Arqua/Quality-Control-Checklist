export type ItemStatus = 'PASS' | 'FAIL' | 'NA';
export type ChecklistStatus = 'DRAFT' | 'COMPLETED';
export type SyncStatus = 'PENDING' | 'SYNCED';

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

export interface SyncPayload {
  results: ChecklistResult[];
  punchItems: PunchItem[];
  instances: ChecklistInstance[];
  timestamp: string;
}
