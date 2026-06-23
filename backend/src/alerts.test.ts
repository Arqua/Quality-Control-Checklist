import {
  validateAlertsPayload,
  validateDeviceRegistration,
  validateSyncPayload,
} from './validation';
import { buildAlertMessages, isValidExpoPushToken } from './push';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const ISO = '2026-06-22T10:00:00.000Z';

const validAlert = () => ({
  id: UUID_A,
  instance_id: UUID_B,
  result_id: UUID_C,
  project_id: UUID_B,
  title: 'HIGH severity: Rebar spacing',
  body: 'Rebar spacing off on Downtown Office Tower',
  severity: 'HIGH',
  created_at: ISO,
});

describe('validateAlertsPayload', () => {
  it('accepts a well-formed alerts batch', () => {
    const res = validateAlertsPayload({ alerts: [validAlert()] });
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('accepts null result_id / project_id', () => {
    const res = validateAlertsPayload({
      alerts: [{ ...validAlert(), result_id: null, project_id: null }],
    });
    expect(res.valid).toBe(true);
  });

  it('rejects a missing alerts array', () => {
    expect(validateAlertsPayload({}).valid).toBe(false);
    expect(validateAlertsPayload({ alerts: {} }).valid).toBe(false);
  });

  it('rejects an empty alerts array', () => {
    const res = validateAlertsPayload({ alerts: [] });
    expect(res.valid).toBe(false);
    expect(res.errors[0].field).toBe('alerts');
  });

  it('rejects an invalid severity (injection guard)', () => {
    const res = validateAlertsPayload({
      alerts: [{ ...validAlert(), severity: 'CRITICAL' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'alerts[0].severity')).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    const res = validateAlertsPayload({ alerts: [{ ...validAlert(), id: 'abc' }] });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'alerts[0].id')).toBe(true);
  });

  it('rejects missing title/body', () => {
    const res = validateAlertsPayload({
      alerts: [{ ...validAlert(), title: '  ', body: '' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'alerts[0].title')).toBe(true);
    expect(res.errors.some((e) => e.field === 'alerts[0].body')).toBe(true);
  });
});

describe('validateSyncPayload severity', () => {
  const baseResult = () => ({
    id: UUID_A,
    instance_id: UUID_B,
    template_item_id: UUID_C,
    status: 'FAIL',
    updated_at: ISO,
  });

  it('accepts a valid severity on a result', () => {
    const res = validateSyncPayload({ results: [{ ...baseResult(), severity: 'HIGH' }] });
    expect(res.valid).toBe(true);
  });

  it('accepts a result with no severity', () => {
    expect(validateSyncPayload({ results: [baseResult()] }).valid).toBe(true);
  });

  it('rejects an invalid severity', () => {
    const res = validateSyncPayload({ results: [{ ...baseResult(), severity: 'SEVERE' }] });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'results[0].severity')).toBe(true);
  });
});

describe('validateDeviceRegistration', () => {
  it('accepts a token-only registration', () => {
    const res = validateDeviceRegistration({
      expoPushToken: 'ExponentPushToken[abc123]',
    });
    expect(res.valid).toBe(true);
  });

  it('accepts role + project scoping', () => {
    const res = validateDeviceRegistration({
      expoPushToken: 'ExponentPushToken[abc123]',
      role: 'manager',
      projectIds: [UUID_A, UUID_B],
    });
    expect(res.valid).toBe(true);
  });

  it('rejects a missing token', () => {
    const res = validateDeviceRegistration({ role: 'manager' });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'expoPushToken')).toBe(true);
  });

  it('rejects non-UUID project ids', () => {
    const res = validateDeviceRegistration({
      expoPushToken: 'ExponentPushToken[abc123]',
      projectIds: ['not-a-uuid'],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'projectIds')).toBe(true);
  });
});

describe('push helpers', () => {
  it('recognises valid Expo push tokens', () => {
    expect(isValidExpoPushToken('ExponentPushToken[abc]')).toBe(true);
    expect(isValidExpoPushToken('ExpoPushToken[abc]')).toBe(true);
    expect(isValidExpoPushToken('not-a-token')).toBe(false);
    expect(isValidExpoPushToken(null)).toBe(false);
  });

  it('builds one message per valid token and drops invalid ones', () => {
    const messages = buildAlertMessages(
      ['ExponentPushToken[a]', 'garbage', 'ExpoPushToken[b]'],
      { id: UUID_A, title: 'T', body: 'B', severity: 'HIGH', project_id: UUID_B }
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      to: 'ExponentPushToken[a]',
      title: 'T',
      body: 'B',
      channelId: 'alerts',
      priority: 'high',
    });
    expect(messages[0].data).toMatchObject({
      type: 'management-alert',
      alertId: UUID_A,
      severity: 'HIGH',
    });
  });
});
