import { useEffect, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

/**
 * Wrapper around the native ARCoreModule (Android only). The native module
 * lives at android/app/src/main/java/com/epocheye/ar/ARCoreModule.kt and
 * already exposes `isAvailable()` + `isInstalled()`.
 *
 * Result is cached for the session — ARCore availability doesn't change
 * mid-app-lifetime in any meaningful way, and we don't want to JNI-cross
 * on every screen mount.
 */

type ArcoreNativeModule = {
  isAvailable: () => Promise<boolean>;
  isInstalled: () => Promise<boolean>;
};

const arcoreNative: ArcoreNativeModule | null =
  Platform.OS === 'android' && NativeModules.ARCoreModule
    ? (NativeModules.ARCoreModule as ArcoreNativeModule)
    : null;

let cachedAvailable: boolean | null = null;
let inflightCheck: Promise<boolean> | null = null;

export async function isArcoreAvailable(): Promise<boolean> {
  if (cachedAvailable !== null) return cachedAvailable;
  if (inflightCheck) return inflightCheck;

  if (!arcoreNative) {
    cachedAvailable = false;
    return false;
  }

  inflightCheck = (async () => {
    try {
      const ok = await arcoreNative.isAvailable();
      cachedAvailable = ok;
      return ok;
    } catch {
      cachedAvailable = false;
      return false;
    } finally {
      inflightCheck = null;
    }
  })();
  return inflightCheck;
}

/**
 * Hook that checks ARCore availability on mount and returns a 3-state result:
 * `checking=true` initially, then `available` resolves to true/false.
 *
 * Use this in screens that need to branch between the AR view and the 3D
 * viewer fallback (ARExperienceScreen).
 */
export function useArcoreAvailability(): {
  checking: boolean;
  available: boolean;
} {
  const [available, setAvailable] = useState<boolean>(cachedAvailable ?? false);
  const [checking, setChecking] = useState<boolean>(cachedAvailable === null);

  useEffect(() => {
    let cancelled = false;
    if (cachedAvailable !== null) {
      setAvailable(cachedAvailable);
      setChecking(false);
      return;
    }
    isArcoreAvailable().then((ok) => {
      if (cancelled) return;
      setAvailable(ok);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { checking, available };
}

/** Test helper — flush the cached result so the next check re-runs. */
export function __resetArcoreCache(): void {
  cachedAvailable = null;
  inflightCheck = null;
}
