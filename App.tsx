import './global.css';

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AppNavigator from './src/navigation';
import { NetworkProvider } from './src/context';
import DialogHost from './src/components/ui/DialogHost';
import OfflineBanner from './src/components/ui/OfflineBanner';
import TourHost from './src/components/tour/TourHost';
import TourErrorBoundary from './src/components/tour/TourErrorBoundary';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import { fcmInit, fcmRegisterAfterPermission } from './src/services/fcmService';
import {
  startNotificationsRealtime,
  stopNotificationsRealtime,
} from './src/services/notificationsSocketService';
import { useSessionStore } from './src/stores/sessionStore';
import { initCrashJournal } from './src/services/crashJournal';

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

// Crash/stability journal: global JS error + rejection handlers and the
// native-crash breadcrumb. Module scope so it's live before first render.
initCrashJournal();

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
      {/* Real IME insets under RN's forced edge-to-edge — the core
          KeyboardAvoidingView mis-measures there (inputs hid behind the
          keyboard on every typing screen). */}
      <KeyboardProvider>
      <SafeAreaProvider style={{ backgroundColor: '#000000' }}>
        <NetworkProvider>
          {/* Root boundary: convert an uncaught render/lifecycle error from a
              silent app close into a calm, recoverable screen (logs to logcat). */}
          <ErrorBoundary resetLabel="Try again">
            {/* The navigator stays mounted regardless of connectivity. Swapping it
                for an offline screen unmounts every screen — losing cached content,
                the nav stack, in-flight forms and any open camera session. Offline
                is a condition screens degrade under (useNetwork().isOffline), not
                an app state. */}
            <AppNavigator />
          </ErrorBoundary>
          {/* Chrome-level offline strip. Inside NetworkProvider (it reads the
              context) and before DialogHost so a transient toast layers above it.
              Mounted here rather than in MainNavigation so it also covers the
              onboarding and login navigator states. */}
          <OfflineBanner />
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
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
