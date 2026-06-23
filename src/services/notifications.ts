import * as Notifications from 'expo-notifications';

/**
 * Local notification handler. Local (on-device) notifications work fully
 * offline — no FCM/APNs or backend required — which suits the offline-first
 * field workflow. When a backend is configured, HIGH-severity alerts also sync
 * up so other managers' devices can be push-notified via Expo's push service.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests notification permission if not already granted. Safe to call on
 * every app start; returns whether notifications are permitted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    return status === 'granted';
  } catch (error) {
    console.warn('[notifications] permission request failed', error);
    return false;
  }
}

/**
 * Fires an immediate local notification. Used to surface a serious
 * (HIGH-severity) event to a manager on this device.
 */
export async function pushLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
      },
      trigger: null, // deliver immediately
    });
  } catch (error) {
    console.warn('[notifications] failed to present notification', error);
  }
}
