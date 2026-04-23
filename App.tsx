import './global.css';

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator from './src/navigation';
import { NetworkProvider, useNetwork } from './src/context';
import NoInternetScreen from './src/screens/NoInternetScreen';
import { fcmInit } from './src/services/fcmService';
import { useArQuotaStore } from './src/stores/arQuotaStore';

// Module-load configure() throws if the native module failed to autolink;
// guard so a mis-linked build reaches the JS runtime instead of dying silently.
try {
  GoogleSignin.configure({
    webClientId:
      '390327894507-b3s027ad3ak1s562p65vuc280dg39q4c.apps.googleusercontent.com',
    offlineAccess: true,
    scopes: ['profile', 'email'],
  });
} catch (err) {
  if (__DEV__) console.warn('[auth] GoogleSignin.configure failed', err);
}

/**
 * Main app content that handles network state
 */
const AppContent: React.FC = () => {
  const { isConnected, isInternetReachable } = useNetwork();

  // Show offline screen when there's no internet
  // isInternetReachable can be null initially, so we check for explicit false
  const isOffline = isConnected === false || isInternetReachable === false;

  if (isOffline) {
    return <NoInternetScreen />;
  }

  return <AppNavigator />;
};

export default function App() {
  useEffect(() => {
    // Best-effort — FCM registration is skipped silently until the user is
    // authenticated and has granted notification permission.
    void fcmInit();
    // Pull AR quota + config so the quota pill + maintenance banner render
    // correctly from first paint. Unauth requests are silently dropped.
    void useArQuotaStore.getState().refresh();
  }, []);

  return (
    <SafeAreaProvider style={{ backgroundColor: '#000000' }}>
      <NetworkProvider>
        <AppContent />
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
