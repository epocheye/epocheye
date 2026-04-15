/**
 * FCM Service
 *
 * Captures the Firebase Cloud Messaging device token, registers it with the
 * backend (POST /api/notifications/register-device), and renders foreground
 * pushes through Notifee. Background/quit pushes are handled by the OS.
 *
 * Backend contract: E:\epocheye_backend\apis\notifications\handler.go
 *
 * Call fcmInit() once at app launch (App.tsx) and fcmRegisterAfterPermission()
 * after the user grants notification permission (OB11_Notifications).
 */

import { Platform } from 'react-native';
import { firebase } from '@react-native-firebase/app';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthenticated } from '../utils/api/auth';
import {
  registerDevice,
  type DeviceType,
} from '../utils/api/notifications';

const STORED_TOKEN_KEY = '@epocheye/fcm_device_token';
const CHANNEL_ID = 'epocheye-default';

let initialized = false;
let unsubscribeForeground: (() => void) | null = null;
let unsubscribeTokenRefresh: (() => void) | null = null;

function deviceType(): DeviceType {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'EpochEye',
    importance: AndroidImportance.HIGH,
  });
}

async function collectDeviceInfo(): Promise<Record<string, unknown>> {
  try {
    return {
      model: await DeviceInfo.getModel(),
      system_version: DeviceInfo.getSystemVersion(),
      app_version: DeviceInfo.getVersion(),
      build_number: DeviceInfo.getBuildNumber(),
      unique_id: await DeviceInfo.getUniqueId(),
    };
  } catch {
    return { platform: Platform.OS };
  }
}

async function sendTokenToBackend(token: string): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) {
    // Not logged in yet — token will be re-sent after login via fcmInit().
    return;
  }

  const cached = await AsyncStorage.getItem(STORED_TOKEN_KEY);
  if (cached === token) {
    return;
  }

  const result = await registerDevice({
    device_token: token,
    device_type: deviceType(),
    device_info: await collectDeviceInfo(),
  });

  if (result.success) {
    await AsyncStorage.setItem(STORED_TOKEN_KEY, token);
  }
}

async function showForegroundNotification(
  msg: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const title = msg.notification?.title ?? (msg.data?.title as string) ?? 'EpochEye';
  const body = msg.notification?.body ?? (msg.data?.message as string) ?? '';
  if (!body) return;

  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
    ios: {
      sound: 'default',
    },
    data: (msg.data as { [k: string]: string }) ?? {},
  });
}

export async function fcmInit(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (firebase.apps.length === 0) {
    if (__DEV__) console.warn('[fcm] no default Firebase app; skipping init');
    return;
  }

  try {
    await ensureAndroidChannel();

    // iOS requires explicit authorization before tokens are issued. Android
    // returns AUTHORIZED automatically; the runtime prompt is handled by
    // react-native-permissions in OB11_Notifications.
    const authStatus = await messaging().requestPermission({ provisional: false });
    const allowed =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!allowed) return;

    const token = await messaging().getToken();
    if (token) {
      await sendTokenToBackend(token);
    }

    // Re-register when Firebase rotates the token.
    unsubscribeTokenRefresh?.();
    unsubscribeTokenRefresh = messaging().onTokenRefresh(async newToken => {
      await AsyncStorage.removeItem(STORED_TOKEN_KEY);
      await sendTokenToBackend(newToken);
    });

    // Render pushes that arrive while the app is foregrounded (iOS does not
    // display them by default, Android only shows data-only if we surface it).
    unsubscribeForeground?.();
    unsubscribeForeground = messaging().onMessage(
      showForegroundNotification,
    );
  } catch (err) {
    if (__DEV__) {
      console.warn('[fcm] init failed', err);
    }
  }
}

/**
 * Call after the user grants notification permission (OB11 flow). Forces a
 * token fetch + backend registration even if fcmInit() ran before the user
 * said yes.
 */
export async function fcmRegisterAfterPermission(): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (token) {
      await AsyncStorage.removeItem(STORED_TOKEN_KEY);
      await sendTokenToBackend(token);
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[fcm] register-after-permission failed', err);
    }
  }
}

/**
 * Clear the cached token marker so the next fcmInit() re-registers. Call on
 * logout.
 */
export async function fcmClearCachedToken(): Promise<void> {
  await AsyncStorage.removeItem(STORED_TOKEN_KEY);
}
