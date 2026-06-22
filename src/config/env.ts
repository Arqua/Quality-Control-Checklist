/**
 * Centralised runtime configuration.
 *
 * The backend URL is supplied via the public Expo env var `EXPO_PUBLIC_API_URL`
 * (set per-environment in EAS build profiles / `.env`). We deliberately do NOT
 * fall back to `localhost` in production: a release binary pointing at
 * `localhost` would silently fail to sync on every device. In development we
 * allow a localhost default to keep the local workflow friction-free.
 */

const DEV_DEFAULT_API_URL = 'http://localhost:3000';

const rawApiUrl =
  process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

/**
 * Resolved backend base URL, or `null` when none is configured in a
 * production build (callers must treat sync as unavailable in that case).
 */
export const API_BASE_URL: string | null = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '')
  : __DEV__
    ? DEV_DEFAULT_API_URL
    : null;

if (!API_BASE_URL && !__DEV__) {
  // Surfaced in crash/analytics logs; sync is skipped until configured.
  console.warn(
    '[config] EXPO_PUBLIC_API_URL is not set for this production build; ' +
      'remote sync is disabled.'
  );
}

/** Optional auth token for backend requests, if the app has logged a user in. */
export const getAuthToken = (): string | null =>
  process.env.EXPO_PUBLIC_API_TOKEN ?? null;
