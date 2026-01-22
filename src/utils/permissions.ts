import { Platform, Alert, Linking } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  PermissionStatus,
} from 'react-native-permissions';

export interface PermissionResult {
  location: boolean;
  camera: boolean;
  storage: boolean;
}

const getPermissions = () => {
  if (Platform.OS === 'ios') {
    return {
      location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      camera: PERMISSIONS.IOS.CAMERA,
      storage: PERMISSIONS.IOS.PHOTO_LIBRARY,
    };
  } else {
    return {
      location: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      camera: PERMISSIONS.ANDROID.CAMERA,
      storage: PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
    };
  }
};

const handlePermissionStatus = (status: PermissionStatus): boolean => {
  return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
};

export const checkAllPermissions = async (): Promise<PermissionResult> => {
  const permissions = getPermissions();

  try {
    const [locationStatus, cameraStatus, storageStatus] = await Promise.all([
      check(permissions.location),
      check(permissions.camera),
      check(permissions.storage),
    ]);

    return {
      location: handlePermissionStatus(locationStatus),
      camera: handlePermissionStatus(cameraStatus),
      storage: handlePermissionStatus(storageStatus),
    };
  } catch {
    return {
      location: false,
      camera: false,
      storage: false,
    };
  }
};

const requestWithTimeout = async (
  permission: any,
  timeoutMs: number = 30000
): Promise<PermissionStatus> => {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Permission request timeout'));
    }, timeoutMs);

    try {
      const result = await request(permission);
      clearTimeout(timeout);
      resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
};

export const requestAllPermissions = async (): Promise<PermissionResult> => {
  const permissions = getPermissions();

  try {
    let locationStatus: PermissionStatus = RESULTS.DENIED;
    let cameraStatus: PermissionStatus = RESULTS.DENIED;
    let storageStatus: PermissionStatus = RESULTS.DENIED;

    try {
      locationStatus = await requestWithTimeout(permissions.location, 15000);
    } catch {
      // Permission denied or timed out
    }
    
    try {
      cameraStatus = await requestWithTimeout(permissions.camera, 15000);
    } catch {
      // Permission denied or timed out
    }
    
    try {
      storageStatus = await requestWithTimeout(permissions.storage, 15000);
    } catch {
      // Permission denied or timed out
    }

    const result = {
      location: handlePermissionStatus(locationStatus),
      camera: handlePermissionStatus(cameraStatus),
      storage: handlePermissionStatus(storageStatus),
    };

    // Handle blocked/denied permanently
    const isAnyBlocked =
      locationStatus === RESULTS.BLOCKED ||
      cameraStatus === RESULTS.BLOCKED ||
      storageStatus === RESULTS.BLOCKED;

    if (isAnyBlocked) {
      Alert.alert(
        'Permissions Required',
        'Some permissions were denied. Please enable them in your device settings to use the AR features.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }

    return result;
  } catch {
    return {
      location: false,
      camera: false,
      storage: false,
    };
  }
};

export const areAllPermissionsGranted = (
  permissions: PermissionResult
): boolean => {
  return permissions.location && permissions.camera && permissions.storage;
};
