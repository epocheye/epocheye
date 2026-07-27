/**
 * Site-readiness pipeline (PERMANENT): thin JS bridge to the native
 * `EpocheyeHeading` module (Android compass via TYPE_ROTATION_VECTOR). Drives
 * pre-AR "walk to the viewing station" guidance before ARCore Earth yaw exists.
 * Returns null on iOS / where the module isn't registered so callers degrade.
 */
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

interface HeadingNativeModule {
  /** Begin emitting heading; lat/lng/alt fix the magnetic declination. */
  start(latitude: number, longitude: number, altitude: number): void;
  stop(): void;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export interface HeadingSample {
  /** 0..360, degrees clockwise from TRUE north (declination-corrected). */
  heading: number;
  /** 0..360, degrees clockwise from MAGNETIC north (pre-correction). */
  magneticHeading: number;
  /** Android SensorManager accuracy: 0 unreliable → 3 high. */
  accuracy: number;
}

const nativeModule =
  (NativeModules.EpocheyeHeading as HeadingNativeModule | undefined) ?? null;

export const HeadingNative = nativeModule;

export const isHeadingAvailable = Platform.OS === 'android' && nativeModule != null;

export const headingEmitter = nativeModule
  ? new NativeEventEmitter(NativeModules.EpocheyeHeading)
  : null;

export const HEADING_EVENT = 'EpocheyeHeading';
