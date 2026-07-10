/**
 * TypeScript bridge for the native OTA module (Android only in v1).
 *
 * The native side (android/.../ota/OtaModule.kt) owns the on-disk bundle markers
 * and the app-restart. This wrapper is a thin, fail-safe facade: every call
 * degrades to a no-op / safe default if the module isn't registered (iOS, or a
 * build where native linking is absent), so the JS OTA flow can never crash the
 * app on a platform that doesn't support it.
 */
import { NativeModules, Platform } from 'react-native';

interface OtaInfo {
  /** Hermes-compat runtime version compiled into this binary. */
  runtimeVersion: string;
  /** Absolute dir the JS downloader writes bundles into. */
  otaDir: string;
  /** bundle_version currently in effect (0 = packaged bundle). */
  currentBundleVersion: number;
}

interface NativeOtaModule {
  getInfo(): Promise<OtaInfo>;
  markBootSuccess(): Promise<boolean>;
  applyAndRestart(info: { path: string; bundleVersion: number }): Promise<boolean>;
}

const Native: NativeOtaModule | undefined =
  Platform.OS === 'android' ? NativeModules.OtaModule : undefined;

/** True only when the native OTA module is present (Android release/debug). */
export const isOtaSupported = (): boolean => !!Native;

/** Read runtime version / current bundle version / download dir. Null if absent. */
export async function getOtaInfo(): Promise<OtaInfo | null> {
  if (!Native) return null;
  try {
    return await Native.getInfo();
  } catch {
    return null;
  }
}

/** Promote the pending bundle to confirmed once the app has booted healthily. */
export async function markOtaBootSuccess(): Promise<void> {
  if (!Native) return;
  try {
    await Native.markBootSuccess();
  } catch {
    // best-effort; a missed confirm just means the guard retries/rolls back
  }
}

/** Stage the verified bundle and restart the app to load it. */
export async function applyOtaAndRestart(info: {
  path: string;
  bundleVersion: number;
}): Promise<void> {
  if (!Native) return;
  try {
    await Native.applyAndRestart(info);
  } catch {
    // if the restart failed to fire, the bundle stays pending and applies on
    // the next natural cold start anyway
  }
}
