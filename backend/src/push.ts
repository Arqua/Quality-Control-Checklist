import axios from 'axios';

/**
 * Expo push fan-out.
 *
 * Sends push notifications to managers' devices when a serious (HIGH-severity)
 * event is registered on another device. Uses Expo's hosted push service
 * directly over HTTP (https://docs.expo.dev/push-notifications/sending-notifications/)
 * so no native FCM/APNs credentials are needed on the server.
 *
 * Kept free of Express/DB imports so it can be unit-tested in isolation.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo push tokens look like `ExponentPushToken[xxxxxxxx]` or `ExpoPushToken[...]`. */
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: 'alerts';
  data: Record<string, unknown>;
}

export interface PushResult {
  /** Number of messages accepted by Expo (best-effort; tickets not polled). */
  sent: number;
  /** Tokens skipped because they were malformed. */
  skipped: number;
}

export function isValidExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && EXPO_TOKEN_RE.test(token);
}

/**
 * Builds Expo push messages for an alert, one per recipient token. Invalid
 * tokens are filtered out. Pure — does no network I/O.
 */
export function buildAlertMessages(
  tokens: string[],
  alert: { id: string; title: string; body: string; severity: string; project_id?: string | null }
): PushMessage[] {
  return tokens
    .filter(isValidExpoPushToken)
    .map((to) => ({
      to,
      title: alert.title,
      body: alert.body,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'alerts' as const,
      data: {
        type: 'management-alert',
        alertId: alert.id,
        severity: alert.severity,
        projectId: alert.project_id ?? null,
      },
    }));
}

/**
 * Sends push messages to Expo in batches of 100 (Expo's documented limit).
 * Network/Expo errors are swallowed and logged — a failed push must never fail
 * the originating request, since the alert is already persisted and will still
 * appear in managers' inboxes on next pull.
 */
export async function sendPushMessages(messages: PushMessage[]): Promise<PushResult> {
  if (messages.length === 0) return { sent: 0, skipped: 0 };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  // Optional: required only if the Expo project enforces push security.
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  let sent = 0;
  const BATCH = 100;
  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    try {
      await axios.post(EXPO_PUSH_URL, chunk, { headers, timeout: 15000 });
      sent += chunk.length;
    } catch (err) {
      console.warn(
        '[push] Expo push batch failed:',
        err instanceof Error ? err.message : err
      );
    }
  }

  return { sent, skipped: 0 };
}

/**
 * Convenience: build + send an alert to a set of recipient tokens.
 */
export async function pushAlert(
  tokens: string[],
  alert: { id: string; title: string; body: string; severity: string; project_id?: string | null }
): Promise<PushResult> {
  const messages = buildAlertMessages(tokens, alert);
  const skipped = tokens.length - messages.length;
  const result = await sendPushMessages(messages);
  return { sent: result.sent, skipped };
}
