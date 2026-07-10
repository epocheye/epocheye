/**
 * OTA orchestration (Android, v1).
 *
 * Launch flow (called from the root navigator AFTER the store-update gate
 * resolves 'ok' — a forced store update always wins over an OTA):
 *
 *   getOtaInfo() → fetchOtaManifest() → download .hbc (react-native-fs)
 *   → verify sha256 → move into place → raise the "Restart now" banner.
 *
 * On "Restart now" the UI calls {@link applyReadyBundle}, which stages the
 * bundle and restarts. On next boot, native loads it as *pending*; once the app
 * mounts, {@link confirmBootHealthy} promotes it to *confirmed*. A pending
 * bundle that crashes before confirm auto-rolls-back natively.
 *
 * Everything here is best-effort and fail-open: any error aborts the update
 * quietly and leaves the running bundle untouched.
 */
import { Platform } from 'react-native';
import {
  downloadFile,
  exists,
  hash,
  mkdir,
  moveFile,
  unlink,
} from '@dr.pogodin/react-native-fs';

import { fetchOtaManifest } from '../utils/api/ota';
import {
  applyOtaAndRestart,
  getOtaInfo,
  isOtaSupported,
  markOtaBootSuccess,
} from '../native/OtaModule';
import { useUpdateStore } from '../stores/updateStore';

/** The verified, ready-to-apply bundle, held until the user taps "Restart now". */
let readyBundle: { path: string; bundleVersion: number } | null = null;
let checkInFlight = false;

/**
 * Check for, download and verify a newer OTA bundle. Safe to call once per
 * launch. No-op on iOS / when the native module is absent. Never throws.
 */
export async function checkForOtaUpdate(): Promise<void> {
  if (Platform.OS !== 'android' || !isOtaSupported() || checkInFlight) return;
  checkInFlight = true;
  try {
    const info = await getOtaInfo();
    if (!info) return;

    const manifest = await fetchOtaManifest({
      platform: 'android',
      runtimeVersion: info.runtimeVersion,
      currentBundleVersion: info.currentBundleVersion,
    });
    if (!manifest || !manifest.update) return;
    // Defensive: only move forward, never to a version we already run.
    if ((manifest.bundle_version ?? 0) <= info.currentBundleVersion) return;

    const version = manifest.bundle_version as number;
    const destDir = `${info.otaDir}/${version}`;
    const destFile = `${destDir}/index.android.bundle`;
    const tmpFile = `${info.otaDir}/pending-${version}.hbc`;

    // Clean any stale partial from a prior aborted attempt.
    await safeUnlink(tmpFile);

    const { promise } = downloadFile({
      fromUrl: manifest.bundle_url as string,
      toFile: tmpFile,
      connectionTimeout: 15000,
      readTimeout: 60000,
    });
    const dl = await promise;
    if (dl.statusCode !== 200) {
      await safeUnlink(tmpFile);
      return;
    }

    // Integrity: SHA-256 must match the manifest (v1 — HTTPS + hash, no signing).
    const digest = (await hash(tmpFile, 'sha256')).toLowerCase();
    if (digest !== manifest.bundle_sha256) {
      await safeUnlink(tmpFile);
      return;
    }

    // Promote tmp → final location.
    await mkdir(destDir);
    await safeUnlink(destFile);
    await moveFile(tmpFile, destFile);

    readyBundle = { path: destFile, bundleVersion: version };
    useUpdateStore
      .getState()
      .showOtaReady({ bundleVersion: version, notes: manifest.notes ?? '' });
  } catch {
    // swallow — leave the running bundle in place
  } finally {
    checkInFlight = false;
  }
}

/** True once a verified bundle is staged and waiting for the user to restart. */
export function hasReadyBundle(): boolean {
  return readyBundle !== null;
}

/** Apply the downloaded bundle: stage it and restart the app. */
export async function applyReadyBundle(): Promise<void> {
  if (!readyBundle) return;
  await applyOtaAndRestart(readyBundle);
}

/**
 * Confirm the running bundle booted healthily (promotes pending → confirmed,
 * arming rollback). Call once the navigator is ready. No-op if nothing pending.
 */
export async function confirmBootHealthy(): Promise<void> {
  await markOtaBootSuccess();
}

async function safeUnlink(path: string): Promise<void> {
  try {
    if (await exists(path)) await unlink(path);
  } catch {
    // ignore
  }
}
