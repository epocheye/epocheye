import './global.css';

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator from './src/navigation';
import { NetworkProvider, useNetwork } from './src/context';
import NoInternetScreen from './src/screens/NoInternetScreen';
import DialogHost from './src/components/ui/DialogHost';
import TourHost from './src/components/tour/TourHost';
import TourErrorBoundary from './src/components/tour/TourErrorBoundary';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import { fcmInit, fcmRegisterAfterPermission } from './src/services/fcmService';
import {
  startNotificationsRealtime,
  stopNotificationsRealtime,
} from './src/services/notificationsSocketService';
import { useSessionStore } from './src/stores/sessionStore';

// Module-load configure() throws if the native module failed to autolink;
// guard so a mis-linked build reaches the JS runtime instead of dying silently.
try {
  GoogleSignin.configure({
    webClientId:
      '390327894507-ma57s298a56a4p1mfo2ttq4pbu48lf89.apps.googleusercontent.com',
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
  const authenticated = useSessionStore(s => s.authenticated);

  useEffect(() => {
    // Best-effort — FCM registration is skipped silently until the user is
    // authenticated and has granted notification permission.
    void fcmInit();
  }, []);

  // fcmInit() runs once at launch and may find the session not yet restored
  // (or the user logs in later). Re-register the device token whenever the
  // session becomes authenticated so already-onboarded users still receive
  // pushes without needing to pass through the onboarding permission screen.
  useEffect(() => {
    if (authenticated) {
      void fcmRegisterAfterPermission();
      // Realtime in-app notifications (WS where available, light poll + FCM
      // otherwise). Torn down on logout so it doesn't poll while signed out.
      startNotificationsRealtime();
      return () => stopNotificationsRealtime();
    }
    return undefined;
  }, [authenticated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ backgroundColor: '#000000' }}>
        <NetworkProvider>
          {/* Root boundary: convert an uncaught render/lifecycle error from a
              silent app close into a calm, recoverable screen (logs to logcat). */}
          <ErrorBoundary resetLabel="Try again">
            <AppContent />
          </ErrorBoundary>
        </NetworkProvider>
        {/* Global heritage-styled dialog + toast host — overlays every screen. */}
        <DialogHost />
        {/* First-run guided product tour — overlays every screen incl. modals.
            Wrapped in a silent boundary so a tour error disables the tour rather
            than crashing the app (the tour auto-runs on first launch). */}
        <TourErrorBoundary>
          <TourHost />
        </TourErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
