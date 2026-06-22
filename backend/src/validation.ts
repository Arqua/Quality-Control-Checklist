/**
 * Pure, dependency-free validation for the sync payload.
 *
 * Kept free of Express/DB imports so it can be unit-tested in isolation and
 * reused by any transport. Every record coming from a mobile client is treated
 * as untrusted input and must pass these checks before touching the database.
 */

export const ITEM_STATUSES = ['PASS', 'FAIL', 'NA'] as const;
export const INSTANCE_STATUSES = ['DRAFT', 'COMPLETED'] as const;
export const PUNCH_STATUSES = ['OPEN', 'CLOSED'] as const;

export type ValidationError = { field: string; message: string };

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// RFC 4122 UUID (any version), case-insensitive.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && UUID_RE.test(v);

const isIsoDate = (v: unknown): boolean =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Caps to defend against oversized payloads being injected in one request. */
export const MAX_RECORDS_PER_TYPE = 1000;

function validateResult(r: any, i: number, errors: ValidationError[]) {
  const p = `results[${i}]`;
  if (!isUuid(r?.id)) errors.push({ field: `${p}.id`, message: 'must be a UUID' });
  if (!isUuid(r?.instance_id))
    errors.push({ field: `${p}.instance_id`, message: 'must be a UUID' });
  if (!isUuid(r?.template_item_id))
    errors.push({ field: `${p}.template_item_id`, message: 'must be a UUID' });
  if (!ITEM_STATUSES.includes(r?.status))
    errors.push({
      field: `${p}.status`,
      message: `must be one of ${ITEM_STATUSES.join(', ')}`,
    });
  if (!isIsoDate(r?.updated_at))
    errors.push({ field: `${p}.updated_at`, message: 'must be an ISO date' });
  if (r?.comments != null && typeof r.comments !== 'string')
    errors.push({ field: `${p}.comments`, message: 'must be a string' });
}

function validatePunchItem(pi: any, i: number, errors: ValidationError[]) {
  const p = `punchItems[${i}]`;
  if (!isUuid(pi?.id)) errors.push({ field: `${p}.id`, message: 'must be a UUID' });
  if (!isUuid(pi?.checklist_instance_id))
    errors.push({
      field: `${p}.checklist_instance_id`,
      message: 'must be a UUID',
    });
  if (!isNonEmptyString(pi?.description))
    errors.push({ field: `${p}.description`, message: 'is required' });
  if (pi?.status != null && !PUNCH_STATUSES.includes(pi.status))
    errors.push({
      field: `${p}.status`,
      message: `must be one of ${PUNCH_STATUSES.join(', ')}`,
    });
}

function validateInstance(inst: any, i: number, errors: ValidationError[]) {
  const p = `instances[${i}]`;
  if (!isUuid(inst?.id)) errors.push({ field: `${p}.id`, message: 'must be a UUID' });
  if (!isUuid(inst?.project_id))
    errors.push({ field: `${p}.project_id`, message: 'must be a UUID' });
  if (!isUuid(inst?.template_id))
    errors.push({ field: `${p}.template_id`, message: 'must be a UUID' });
  if (!isNonEmptyString(inst?.inspector_name))
    errors.push({ field: `${p}.inspector_name`, message: 'is required' });
  if (!INSTANCE_STATUSES.includes(inst?.status))
    errors.push({
      field: `${p}.status`,
      message: `must be one of ${INSTANCE_STATUSES.join(', ')}`,
    });
}

/**
 * Validates the full sync payload shape and every record within it.
 */
export function validateSyncPayload(body: any): ValidationResult {
  const errors: ValidationError[] = [];

  if (body == null || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'must be an object' }] };
  }

  const { results, punchItems, instances } = body;

  for (const [name, arr] of Object.entries({ results, punchItems, instances })) {
    if (arr !== undefined && !Array.isArray(arr)) {
      errors.push({ field: name, message: 'must be an array' });
    } else if (Array.isArray(arr) && arr.length > MAX_RECORDS_PER_TYPE) {
      errors.push({
        field: name,
        message: `exceeds maximum of ${MAX_RECORDS_PER_TYPE} records`,
      });
    }
  }

  // Bail early if the top-level shape is wrong; per-item checks would be noise.
  if (errors.length > 0) return { valid: false, errors };

  (Array.isArray(results) ? results : []).forEach((r, i) =>
    validateResult(r, i, errors)
  );
  (Array.isArray(punchItems) ? punchItems : []).forEach((pi, i) =>
    validatePunchItem(pi, i, errors)
  );
  (Array.isArray(instances) ? instances : []).forEach((inst, i) =>
    validateInstance(inst, i, errors)
  );

  return { valid: errors.length === 0, errors };
}

/**
 * Collects every instance id referenced by a payload (directly or via results/
 * punch items). Used to enforce that the caller may only write to instances on
 * projects they have access to.
 */
export function collectInstanceIds(body: any): string[] {
  const ids = new Set<string>();
  for (const r of body?.results ?? []) if (isUuid(r?.instance_id)) ids.add(r.instance_id);
  for (const pi of body?.punchItems ?? [])
    if (isUuid(pi?.checklist_instance_id)) ids.add(pi.checklist_instance_id);
  for (const inst of body?.instances ?? []) if (isUuid(inst?.id)) ids.add(inst.id);
  return [...ids];
}
