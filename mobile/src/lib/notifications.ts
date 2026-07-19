import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("nightly-review", {
      name: "Nightly review",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return true;
}

/** The product's core ritual: a local notification each evening to close the day. */
export async function scheduleNightlyReview(
  hour = 20,
  minute = 0,
): Promise<boolean> {
  const ok = await ensureNotificationPermission();
  if (!ok) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Close your day",
      body: "A minute to log what you spent — and recover anything you forgot.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return true;
}

/** Expo push token for remote push (needs an EAS projectId). Returns null on a
 * local dev build without one — local scheduled notifications still work. */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (!(await ensureNotificationPermission())) return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}
