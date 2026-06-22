import {
  validateSyncPayload,
  collectInstanceIds,
  MAX_RECORDS_PER_TYPE,
} from './validation';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const ISO = '2026-06-22T10:00:00.000Z';

const validResult = () => ({
  id: UUID_A,
  instance_id: UUID_B,
  template_item_id: UUID_C,
  status: 'PASS',
  comments: 'ok',
  updated_at: ISO,
});

const validInstance = () => ({
  id: UUID_B,
  project_id: UUID_C,
  template_id: UUID_A,
  inspector_name: 'Sarah Chen',
  status: 'COMPLETED',
});

const validPunchItem = () => ({
  id: UUID_A,
  checklist_instance_id: UUID_B,
  template_item_id: UUID_C,
  description: 'Rebar spacing off',
  status: 'OPEN',
});

describe('validateSyncPayload', () => {
  it('accepts a well-formed payload', () => {
    const res = validateSyncPayload({
      results: [validResult()],
      punchItems: [validPunchItem()],
      instances: [validInstance()],
      timestamp: ISO,
    });
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('accepts empty arrays / missing optional sections', () => {
    expect(validateSyncPayload({}).valid).toBe(true);
    expect(validateSyncPayload({ results: [] }).valid).toBe(true);
  });

  it('rejects a non-object body', () => {
    expect(validateSyncPayload(null).valid).toBe(false);
    expect(validateSyncPayload('nope' as unknown).valid).toBe(false);
  });

  it('rejects when a section is not an array', () => {
    const res = validateSyncPayload({ results: { id: UUID_A } });
    expect(res.valid).toBe(false);
    expect(res.errors[0].field).toBe('results');
  });

  it('rejects invalid UUIDs', () => {
    const res = validateSyncPayload({ results: [{ ...validResult(), id: 'abc' }] });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'results[0].id')).toBe(true);
  });

  it('rejects an invalid item status (injection guard)', () => {
    const res = validateSyncPayload({
      results: [{ ...validResult(), status: 'DROP TABLE' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'results[0].status')).toBe(true);
  });

  it('rejects a non-ISO updated_at', () => {
    const res = validateSyncPayload({
      results: [{ ...validResult(), updated_at: 'not-a-date' }],
    });
    expect(res.valid).toBe(false);
  });

  it('rejects instances missing an inspector name', () => {
    const res = validateSyncPayload({
      instances: [{ ...validInstance(), inspector_name: '   ' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'instances[0].inspector_name')).toBe(
      true
    );
  });

  it('rejects oversized payloads', () => {
    const many = Array.from({ length: MAX_RECORDS_PER_TYPE + 1 }, validResult);
    const res = validateSyncPayload({ results: many });
    expect(res.valid).toBe(false);
    expect(res.errors[0].field).toBe('results');
  });
});

describe('collectInstanceIds', () => {
  it('dedupes ids referenced across results, punch items, and instances', () => {
    const ids = collectInstanceIds({
      results: [validResult()], // instance_id = UUID_B
      punchItems: [validPunchItem()], // checklist_instance_id = UUID_B
      instances: [validInstance()], // id = UUID_B
    });
    expect(ids).toEqual([UUID_B]);
  });

  it('returns an empty array for an empty payload', () => {
    expect(collectInstanceIds({})).toEqual([]);
  });
});
