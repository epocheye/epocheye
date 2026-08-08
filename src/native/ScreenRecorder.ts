/**
 * TypeScript bridge for the AR clip recorder (Android only).
 *
 * Mirrors HeadingModule.ts: presence-checked module, an `isAvailable` export so
 * callers can hide the control rather than crash, and a single NativeEventEmitter.
 *
 * One event name carrying a discriminated payload, rather than a family of
 * events — the whole state machine then lives in one place and cannot get out
 * of step with itself.
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const Native = NativeModules.EpocheyeScreenRecorder;

export type RecorderErrorCode =
  | 'unsupported_os'
  | 'no_activity'
  | 'already_recording'
  | 'consent_denied'
  | 'consent_stale'
  | 'disk_full'
  | 'service_start_failed'
  | 'projection_failed'
  | 'encoder_failed'
  | 'projection_revoked'
  | 'interrupted_background'
  | 'interrupted_rotation'
  | 'too_short'
  | 'save_failed';

export interface RecordingOptions {
  /** Record the mic. Degrades to silent rather than failing. Default true. */
  audio?: boolean;
  /** Hard-capped at 60 s by native. Default 30 s. */
  maxDurationMs?: number;
  /** Publish to Movies/Epocheye. Default true. */
  saveToGallery?: boolean;
  /** Site slug — used in the filename. */
  fileNameHint?: string;
}

export interface ClipResult {
  /** file:// in app cache. Always present. */
  uri: string;
  /** content:// in the user's gallery. Absent if the save failed. */
  galleryUri?: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
  hasAudio: boolean;
  /** Saved, but with a caveat worth telling the user about. */
  degraded?: RecorderErrorCode;
}

export type RecordingEvent =
  | { state: 'preparing' }
  | { state: 'recording'; elapsedMs: number; hasAudio: boolean }
  | { state: 'finalizing' }
  | { state: 'saved' }
  | { state: 'error'; code: RecorderErrorCode; message?: string };

export const RECORDING_EVENT = 'EpocheyeRecording';

export const isScreenRecorderAvailable =
  Platform.OS === 'android' && Native != null;

export const recordingEmitter = Native
  ? new NativeEventEmitter(Native)
  : null;

export async function isRecordingSupported(): Promise<{
  supported: boolean;
  sdkInt: number;
}> {
  if (!Native) return { supported: false, sdkInt: 0 };
  try {
    return await Native.isSupported();
  } catch {
    return { supported: false, sdkInt: 0 };
  }
}

/** Show the system consent dialog. Rejects with a RecorderErrorCode. */
export function requestConsent(options?: RecordingOptions): Promise<void> {
  if (!Native) return Promise.reject(new Error('unsupported_os'));
  return Native.requestConsent(options ?? {});
}

export function startRecording(options?: RecordingOptions): Promise<void> {
  if (!Native) return Promise.reject(new Error('unsupported_os'));
  return Native.start(options ?? {});
}

export function stopRecording(): Promise<ClipResult> {
  if (!Native) return Promise.reject(new Error('unsupported_os'));
  return Native.stop();
}

export function cancelRecording(): Promise<void> {
  if (!Native) return Promise.resolve();
  return Native.cancel();
}

/** Hand the clip to the system chooser (Instagram, WhatsApp, …). */
export function shareClip(params: {
  uri: string;
  text?: string;
}): Promise<void> {
  if (!Native) return Promise.reject(new Error('unsupported_os'));
  return Native.share(params);
}
