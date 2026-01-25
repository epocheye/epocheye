/**
 * Permission Service
 * Unified permission handling for camera, location, and storage
 */

import { Platform, Alert, Linking } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  PermissionStatus,
  openSettings,
} from 'react-native-permissions';
import { APP_CONFIG } from '../../core/config';

/**
 * Permission check result
 */
export interface PermissionResult {
  location: boolean;
  camera: boolean;
  storage: boolean;
}

/**
 * Individual permission status
 */
export type PermissionName = 'location' | 'camera' | 'storage';

/**
 * Get platform-specific permission constants
 */
function getPermissions() {
  if (Platform.OS === 'ios') {
    return {
      location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      camera: PERMISSIONS.IOS.CAMERA,
      storage: PERMISSIONS.IOS.PHOTO_LIBRARY,
    };
  }

  return {
    location: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    camera: PERMISSIONS.ANDROID.CAMERA,
    storage: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
  };
}

/**
 * Check if a permission status indicates granted
 */
function isGranted(status: PermissionStatus): boolean {
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
}

/**
 * PermissionService provides unified permission handling
 */
export class PermissionService {
  /**
   * Check all required permissions
   * @returns Object indicating granted status for each permission
   */
  static async checkAll(): Promise<PermissionResult> {
    const permissions = getPermissions();

    try {
      const [locationStatus, cameraStatus, storageStatus] = await Promise.all([
        check(permissions.location),
        check(permissions.camera),
        check(permissions.storage),
      ]);

      return {
        location: isGranted(locationStatus),
        camera: isGranted(cameraStatus),
        storage: isGranted(storageStatus),
      };
    } catch (error) {
      console.error('[PermissionService] Error checking permissions:', error);
      return {
        location: false,
        camera: false,
        storage: false,
      };
    }
  }

  /**
   * Check a single permission
   * @param permission - Permission name to check
   * @returns true if granted, false otherwise
   */
  static async check(permission: PermissionName): Promise<boolean> {
    const permissions = getPermissions();

    try {
      const status = await check(permissions[permission]);
      return isGranted(status);
    } catch (error) {
      console.error(`[PermissionService] Error checking ${permission}:`, error);
      return false;
    }
  }

  /**
   * Request a single permission with timeout
   * @param permission - Permission name to request
   * @returns true if granted, false otherwise
   */
  static async request(permission: PermissionName): Promise<boolean> {
    const permissions = getPermissions();

    try {
      const result = await Promise.race([
        request(permissions[permission]),
        new Promise<PermissionStatus>((_, reject) =>
          setTimeout(
            () => reject(new Error('Permission request timeout')),
            APP_CONFIG.PERMISSIONS.REQUEST_TIMEOUT_MS
          )
        ),
      ]);

      return isGranted(result);
    } catch (error) {
      console.error(`[PermissionService] Error requesting ${permission}:`, error);
      return false;
    }
  }

  /**
   * Request all required permissions sequentially
   * @returns Object indicating granted status for each permission
   */
  static async requestAll(): Promise<PermissionResult> {
    const result: PermissionResult = {
      location: false,
      camera: false,
      storage: false,
    };

    // Request permissions sequentially to avoid conflicts
    result.location = await this.request('location');
    result.camera = await this.request('camera');
    result.storage = await this.request('storage');

    return result;
  }

  /**
   * Check if all required permissions are granted
   * @param result - Permission result to check
   * @returns true if all permissions are granted
   */
  static areAllGranted(result: PermissionResult): boolean {
    return result.location && result.camera && result.storage;
  }

  /**
   * Check if any required permissions are missing
   * @param result - Permission result to check
   * @returns Array of missing permission names
   */
  static getMissingPermissions(result: PermissionResult): PermissionName[] {
    const missing: PermissionName[] = [];

    if (!result.location) missing.push('location');
    if (!result.camera) missing.push('camera');
    if (!result.storage) missing.push('storage');

    return missing;
  }

  /**
   * Open device settings for the app
   */
  static async openAppSettings(): Promise<void> {
    try {
      await openSettings();
    } catch (error) {
      console.error('[PermissionService] Error opening settings:', error);
      // Fallback to Linking
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    }
  }

  /**
   * Show alert prompting user to enable permissions in settings
   * @param permission - The permission that needs to be enabled
   */
  static showSettingsAlert(permission: PermissionName): void {
    const permissionLabels: Record<PermissionName, string> = {
      location: 'Location',
      camera: 'Camera',
      storage: 'Photo Library',
    };

    Alert.alert(
      `${permissionLabels[permission]} Permission Required`,
      `Please enable ${permissionLabels[permission].toLowerCase()} access in your device settings to use this feature.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => this.openAppSettings(),
        },
      ]
    );
  }
}
