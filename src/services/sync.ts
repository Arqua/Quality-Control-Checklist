import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as db from '../database/db';
import { SyncPayload } from '../types/database';
import { API_BASE_URL } from '../config/env';
import { pushLocalNotification, getExpoPushToken } from './notifications';

/** Cursor (ISO timestamp) for incremental alert pulls. */
const LAST_ALERT_PULL_KEY = 'lastAlertPull';

/** Register the device's push token at most once per app session. */
let deviceRegistered = false;

// Generous timeout: a free-tier backend (e.g. Render) spins down when idle and
// can take 30-60s to cold-start on the first request after inactivity.
const REQUEST_TIMEOUT_MS = 60000;

export interface SyncResult {
  ok: boolean;
  uploadedPhotos: number;
  syncedResults: number;
  syncedPunchItems: number;
  syncedInstances: number;
  /** Alerts pushed up to the backend this cycle. */
  alertsPushed: number;
  /** New alerts pulled down from the backend this cycle. */
  alertsPulled: number;
  /** Present when sync was skipped or failed. */
  reason?: string;
}

const authHeaders = (token?: string): Record<string, string> => {
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Uploads any locally-attached photos that have not yet reached object storage,
 * recording the returned remote URL against each result. Returns the number of
 * photos successfully uploaded. Failures are left PENDING for the next pass.
 */
async function uploadPendingPhotos(baseUrl: string, token?: string): Promise<number> {
  const pending = await db.getPendingPhotoUploads();
  let uploaded = 0;

  for (const result of pending) {
    if (!result.photo_local_uri) continue;

    try {
      const form = new FormData();
      // React Native's FormData accepts a {uri, name, type} file descriptor.
      form.append('photo', {
        uri: result.photo_local_uri,
        name: `${result.id}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
      form.append('resultId', result.id);
      form.append('instanceId', result.instance_id);

      const res = await axios.post(`${baseUrl}/api/photos`, form, {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'Content-Type': 'multipart/form-data', ...authHeaders(token) },
      });

      const remoteUrl: string | undefined = res.data?.photoUrl;
      if (res.status >= 200 && res.status < 300 && remoteUrl) {
        await db.markPhotoUploaded(result.id, remoteUrl);
        uploaded += 1;
      }
    } catch (err) {
      // Leave this photo PENDING; it will retry on the next sync.
      console.warn(`[sync] photo upload failed for ${result.id}`, err);
    }
  }

  return uploaded;
}

/**
 * Pushes pending metadata (results, punch items, completed instances) to the
 * backend and marks the acknowledged rows as SYNCED.
 */
async function pushMetadata(
  baseUrl: string,
  payload: SyncPayload,
  token?: string
): Promise<{ results: number; punchItems: number; instances: number }> {
  if (
    payload.results.length === 0 &&
    payload.punchItems.length === 0 &&
    payload.instances.length === 0
  ) {
    return { results: 0, punchItems: 0, instances: 0 };
  }

  const res = await axios.post(`${baseUrl}/api/sync`, payload, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Sync rejected with status ${res.status}`);
  }

  // Trust the server's acknowledgement when present; otherwise fall back to
  // everything we sent (the server processed the transaction atomically).
  const acked = res.data?.synced ?? {};
  const resultIds: string[] = acked.resultIds ?? payload.results.map((r) => r.id);
  const punchItemIds: string[] =
    acked.punchItemIds ?? payload.punchItems.map((p) => p.id);
  const instanceIds: string[] =
    acked.instanceIds ?? payload.instances.map((i) => i.id);

  await db.markAsSynced(resultIds, punchItemIds, instanceIds);
  return {
    results: resultIds.length,
    punchItems: punchItemIds.length,
    instances: instanceIds.length,
  };
}

/**
 * Pushes locally-raised alerts (HIGH-severity events, including reported
 * incidents) up to the backend. The server persists them and fans out a push
 * notification to other managers' registered devices. Acknowledged ids are
 * marked SYNCED so they are not resent.
 */
async function pushAlerts(baseUrl: string, token?: string): Promise<number> {
  const pending = await db.getPendingAlerts();
  if (pending.length === 0) return 0;

  const payload = {
    alerts: pending.map((a) => ({
      id: a.id,
      instance_id: a.instance_id,
      result_id: a.result_id ?? null,
      project_id: a.project_id ?? null,
      title: a.title,
      body: a.body,
      severity: a.severity,
      created_at: a.created_at,
    })),
  };

  const res = await axios.post(`${baseUrl}/api/alerts`, payload, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Alert push rejected with status ${res.status}`);
  }

  const acked: string[] = res.data?.synced?.alertIds ?? pending.map((a) => a.id);
  await db.markAlertsSynced(acked);
  return acked.length;
}

/**
 * Pulls alerts visible to this manager from the backend (incremental via a
 * stored cursor) so events raised on other devices appear in this device's
 * inbox. Newly-arrived HIGH-severity alerts trigger a local notification.
 * Inspectors receive an empty list from the server, so this is a no-op for them.
 */
async function pullAlerts(baseUrl: string, token?: string): Promise<number> {
  const since = await AsyncStorage.getItem(LAST_ALERT_PULL_KEY);
  const url = since
    ? `${baseUrl}/api/alerts?since=${encodeURIComponent(since)}`
    : `${baseUrl}/api/alerts`;

  const res = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: authHeaders(token),
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Alert pull rejected with status ${res.status}`);
  }

  const serverAlerts: any[] = res.data?.alerts ?? [];
  let newCount = 0;

  for (const alert of serverAlerts) {
    const isNew = await db.upsertServerAlert(alert);
    if (!isNew) continue;
    newCount += 1;
    // Only notify on incremental pulls (a non-null cursor); the first pull
    // backfills history and should not fire a burst of notifications.
    if (since && alert.severity === 'HIGH' && !alert.acknowledged) {
      await pushLocalNotification(alert.title, alert.body, { alertId: alert.id });
    }
  }

  await AsyncStorage.setItem(LAST_ALERT_PULL_KEY, new Date().toISOString());
  return newCount;
}

/**
 * Best-effort registration of this device's Expo push token so the backend can
 * deliver alert push notifications. Runs at most once per session and never
 * throws — a failure simply leaves the device on pull-based alert delivery.
 */
async function registerDeviceForPush(baseUrl: string, token?: string): Promise<void> {
  if (deviceRegistered || !token) return;
  try {
    const expoPushToken = await getExpoPushToken();
    if (!expoPushToken) return;
    await axios.post(
      `${baseUrl}/api/devices`,
      { expoPushToken },
      { timeout: REQUEST_TIMEOUT_MS, headers: authHeaders(token) }
    );
    deviceRegistered = true;
  } catch (err) {
    console.warn('[sync] device push registration failed', err);
  }
}

/**
 * Runs a full sync cycle: upload photos first (so metadata carries remote
 * URLs), push metadata, then exchange management alerts (push local ones up,
 * pull others' down). Network/offline errors are swallowed and reported via the
 * returned {@link SyncResult} so the caller can retry later.
 *
 * @param token Optional JWT token from backend login. If not provided, sync
 *              will proceed without authentication (offline-only mode).
 */
export async function runSync(token?: string): Promise<SyncResult> {
  if (!API_BASE_URL) {
    return {
      ok: false,
      uploadedPhotos: 0,
      syncedResults: 0,
      syncedPunchItems: 0,
      syncedInstances: 0,
      alertsPushed: 0,
      alertsPulled: 0,
      reason: 'No backend URL configured',
    };
  }

  try {
    const uploadedPhotos = await uploadPendingPhotos(API_BASE_URL, token);
    const payload = await db.getPendingSyncPayload();
    const pushed = await pushMetadata(API_BASE_URL, payload, token);

    // Alert exchange is isolated so a failure here never fails the whole sync
    // (e.g. inspectors lack alert read access, or push tokens are unavailable).
    let alertsPushed = 0;
    let alertsPulled = 0;
    try {
      await registerDeviceForPush(API_BASE_URL, token);
      alertsPushed = await pushAlerts(API_BASE_URL, token);
      alertsPulled = await pullAlerts(API_BASE_URL, token);
    } catch (alertErr) {
      console.warn('[sync] alert exchange failed', alertErr);
    }

    return {
      ok: true,
      uploadedPhotos,
      syncedResults: pushed.results,
      syncedPunchItems: pushed.punchItems,
      syncedInstances: pushed.instances,
      alertsPushed,
      alertsPulled,
    };
  } catch (err) {
    return {
      ok: false,
      uploadedPhotos: 0,
      syncedResults: 0,
      syncedPunchItems: 0,
      syncedInstances: 0,
      alertsPushed: 0,
      alertsPulled: 0,
      reason: err instanceof Error ? err.message : 'Sync failed',
    };
  }
}
