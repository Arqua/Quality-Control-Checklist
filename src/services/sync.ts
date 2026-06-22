import axios from 'axios';
import * as db from '../database/db';
import { SyncPayload } from '../types/database';
import { API_BASE_URL, getAuthToken } from '../config/env';

const REQUEST_TIMEOUT_MS = 15000;

export interface SyncResult {
  ok: boolean;
  uploadedPhotos: number;
  syncedResults: number;
  syncedPunchItems: number;
  syncedInstances: number;
  /** Present when sync was skipped or failed. */
  reason?: string;
}

const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Uploads any locally-attached photos that have not yet reached object storage,
 * recording the returned remote URL against each result. Returns the number of
 * photos successfully uploaded. Failures are left PENDING for the next pass.
 */
async function uploadPendingPhotos(baseUrl: string): Promise<number> {
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
        headers: { 'Content-Type': 'multipart/form-data', ...authHeaders() },
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
  payload: SyncPayload
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
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
 * Runs a full sync cycle: upload photos first (so metadata carries remote
 * URLs), then push metadata. Network/offline errors are swallowed and reported
 * via the returned {@link SyncResult} so the caller can retry later.
 */
export async function runSync(): Promise<SyncResult> {
  if (!API_BASE_URL) {
    return {
      ok: false,
      uploadedPhotos: 0,
      syncedResults: 0,
      syncedPunchItems: 0,
      syncedInstances: 0,
      reason: 'No backend URL configured',
    };
  }

  try {
    const uploadedPhotos = await uploadPendingPhotos(API_BASE_URL);
    const payload = await db.getPendingSyncPayload();
    const pushed = await pushMetadata(API_BASE_URL, payload);

    return {
      ok: true,
      uploadedPhotos,
      syncedResults: pushed.results,
      syncedPunchItems: pushed.punchItems,
      syncedInstances: pushed.instances,
    };
  } catch (err) {
    return {
      ok: false,
      uploadedPhotos: 0,
      syncedResults: 0,
      syncedPunchItems: 0,
      syncedInstances: 0,
      reason: err instanceof Error ? err.message : 'Sync failed',
    };
  }
}
