/**
 * TypeScript bridge for the native AR availability module.
 *
 * On Android it calls `ARCoreModule` (ARCore availability check).
 * On iOS it calls `ARKitModule` (ARWorldTrackingConfiguration.isSupported).
 * Returns `false` if neither native module is registered (e.g. running on
 * an unsupported simulator or a device where the native code didn't link).
 *
 * The exported names stay as `isARCoreAvailable` / `isARCoreInstalled` so
 * existing callers (`useARCore`, screens) don't need to change — the name
 * is now a general "is native AR available" check.
 */

import { NativeModules, Platform } from 'react-native';

const NativeARModule =
  Platform.OS === 'ios'
    ? NativeModules.ARKitModule
    : NativeModules.ARCoreModule;

export async function isARCoreAvailable(): Promise<boolean> {
  if (!NativeARModule) return false;
  try {
    return await NativeARModule.isAvailable();
  } catch {
    return false;
  }
}

export async function isARCoreInstalled(): Promise<boolean> {
  if (!NativeARModule) return false;
  try {
    return await NativeARModule.isInstalled();
  } catch {
    return false;
  }
}
