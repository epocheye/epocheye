/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({isConnected: true, isInternetReachable: true}),
  ),
  useNetInfo: jest.fn(() => ({isConnected: true, isInternetReachable: true})),
}));

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 0),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-permissions', () => {
  const RESULTS = {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    GRANTED: 'granted',
    LIMITED: 'limited',
  };

  return {
    RESULTS,
    check: jest.fn(() => Promise.resolve(RESULTS.GRANTED)),
    request: jest.fn(() => Promise.resolve(RESULTS.GRANTED)),
    PERMISSIONS: {
      ANDROID: {
        ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
        CAMERA: 'android.permission.CAMERA',
        READ_MEDIA_IMAGES: 'android.permission.READ_MEDIA_IMAGES',
      },
      IOS: {
        LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
        CAMERA: 'ios.permission.CAMERA',
        PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
      },
    },
  };
});

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: jest.fn(() => null),
  useCameraPermission: jest.fn(() => ({
    hasPermission: true,
    requestPermission: jest.fn(() => Promise.resolve(true)),
  })),
}));

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

// Native sign-in module ships ESM; mock so App.tsx imports resolve under Jest.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({})),
    signOut: jest.fn(() => Promise.resolve()),
    isSignedIn: jest.fn(() => Promise.resolve(false)),
    getCurrentUser: jest.fn(() => Promise.resolve(null)),
  },
  GoogleSigninButton: 'GoogleSigninButton',
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

// Firebase (FCM) modules ship ESM; mock the surface fcmService imports.
jest.mock('@react-native-firebase/app', () => ({
  firebase: {apps: [], app: jest.fn(() => ({}))},
}));
jest.mock('@react-native-firebase/messaging', () => {
  const messaging = () => ({
    requestPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('test-token')),
    onMessage: jest.fn(() => jest.fn()),
    onTokenRefresh: jest.fn(() => jest.fn()),
    setBackgroundMessageHandler: jest.fn(),
    registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
  });
  messaging.AuthorizationStatus = {AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0};
  return {__esModule: true, default: messaging};
});
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(() => Promise.resolve('default')),
    displayNotification: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve({authorizationStatus: 1})),
    onForegroundEvent: jest.fn(() => jest.fn()),
  },
  AndroidImportance: {HIGH: 4, DEFAULT: 3, LOW: 2},
  EventType: {PRESS: 1, DISMISSED: 0},
}));
jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(() => Promise.resolve('test-device')),
  getModel: jest.fn(() => 'test-model'),
  getSystemVersion: jest.fn(() => '0'),
  getVersion: jest.fn(() => '1.0.0'),
}));

// Native filesystem module (GLB cache) ships ESM; mock the surface glbCache uses.
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  downloadFile: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({statusCode: 200, bytesWritten: 0}),
  })),
  exists: jest.fn(() => Promise.resolve(false)),
  mkdir: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({size: 0, isFile: () => true})),
  unlink: jest.fn(() => Promise.resolve()),
  readDir: jest.fn(() => Promise.resolve([])),
  readFile: jest.fn(() => Promise.resolve('')),
  writeFile: jest.fn(() => Promise.resolve()),
}));
