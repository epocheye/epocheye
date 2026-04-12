/**
 * TypeScript bridge for the ARCore native module.
 *
 * Exposes ARCore availability checks to the JS layer.
 * Returns `false` on iOS or when the native module is not registered.
 */

import { NativeModules, Platform } from 'react-native';

const { ARCoreModule } = NativeModules;

export async function isARCoreAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!ARCoreModule) return false;
  try {
    return await ARCoreModule.isAvailable();
  } catch {
    return false;
  }
}

export async function isARCoreInstalled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!ARCoreModule) return false;
  try {
    return await ARCoreModule.isInstalled();
  } catch {
    return false;
  }
}
