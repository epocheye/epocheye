import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
// Aliased: `AppState` is already the name of this file's local navigator-state type.
import { AppState as RNAppState, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigation from './MainNavigation';
import { navigationRef } from './navigationRef';
import LoginScreen from '../screens/Auth/LoginScreen';
import { ROUTES, STORAGE_KEYS } from '../core/constants';
import type { LinkingOptions } from '@react-navigation/native';
import type { MainStackParamList } from '../core/types/navigation.types';
import AnimatedLogo from '../components/ui/AnimatedLogo';
import UpdateRequiredScreen from '../screens/System/UpdateRequiredScreen';
import MaintenanceScreen from '../screens/System/MaintenanceScreen';
import { OnboardingCallbackProvider } from '../context/OnboardingCallbackContext';
import {
  resolveGates,
  type AppConfig,
  type Maintenance,
} from '../utils/api/appConfig';
import { maybeShowOptionalUpdate } from '../stores/updateStore';
import { checkForOtaUpdate, confirmBootHealthy } from '../services/otaService';
import { useSessionStore } from '../stores/sessionStore';
import { useUserStore } from '../stores/userStore';
import { usePlacesStore } from '../stores/placesStore';
import { useCurrentZoneStore } from '../stores/currentZoneStore';
import { useNotificationsStore } from '../stores/notificationsStore';
import { analytics } from '../services/analytics';
import { recordNavBreadcrumb } from '../services/crashJournal';

type AppState = 'loading' | 'onboarding' | 'login' | 'main';

// How often to re-check the launch gates while the app is open. Sets the upper
// bound on how long a non-admin keeps using the app after maintenance is
// switched on; a foreground return re-checks immediately regardless.
const GATE_POLL_MS = 60_000;

// Deep links: epocheye://site/<slug> (and https://epocheye.com/s/... → the website
// bounces to the scheme) open SiteDetail directly. Only resolves once the main
// navigator is mounted (authenticated); otherwise the user lands on login first.
const linking: LinkingOptions<MainStackParamList> = {
  prefixes: ['epocheye://', 'https://epocheye.com', 'https://epocheye.app'],
  config: {
    screens: {
      [ROUTES.MAIN.SITE_DETAIL]: 'site/:slug',
    },
  },
};

const AppNavigator: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  // Hard version gate — non-null blocks the whole app with UpdateRequiredScreen.
  const [updateGate, setUpdateGate] = useState<AppConfig | null>(null);
  // Maintenance gate — non-null blocks every non-admin with MaintenanceScreen.
  const [maintenanceGate, setMaintenanceGate] = useState<Maintenance | null>(
    null,
  );
  // Set when an admin uses the long-press door on the maintenance screen; lets
  // LoginScreen render *through* the gate so they can sign in and be recognised.
  const [adminLoginRequested, setAdminLoginRequested] = useState(false);
  const bootstrapSession = useSessionStore(state => state.bootstrapSession);
  const setSessionAuthenticated = useSessionStore(
    state => state.setAuthenticated,
  );

  // Analytics: boot the pipeline once, and auto-capture a screen_view on every
  // route change (covers both the onboarding and main navigators). The shared
  // module-level navigationRef is also used by the guided tour (TourHost).
  const routeNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    void analytics.init();
  }, []);

  // Resolves both launch gates (version + maintenance) from a single fetch.
  // FAIL-OPEN throughout — resolveGates only reports a gate on a successful
  // fetch, so a backend outage or offline start leaves the app fully usable.
  // Runs on launch, every 60s, and whenever the app returns to the foreground,
  // so flipping maintenance mode on reaches users already inside the app.
  const runGateCheck = useCallback(async (isLaunch = false) => {
    const { update, maintenance } = await resolveGates();

    setMaintenanceGate(maintenance);
    // Signing in cleared the gate → drop back out of the admin-login detour.
    if (!maintenance) setAdminLoginRequested(false);

    if (update.state === 'required') {
      // A forced STORE update wins over OTA — don't ship JS onto a build the
      // operator has decided must go to the store.
      setUpdateGate(update.config);
      return;
    }
    if (!isLaunch) return;

    if (update.state === 'optional') {
      void maybeShowOptionalUpdate(update.config);
    }
    // Build is allowed to run → check for an OTA JS-bundle update (Android,
    // fail-open; raises the "Restart now" banner when one is downloaded).
    void checkForOtaUpdate();
  }, []);

  useEffect(() => {
    void runGateCheck(true);

    const interval = setInterval(() => {
      void runGateCheck();
    }, GATE_POLL_MS);

    const sub = RNAppState.addEventListener('change', next => {
      if (next === 'active') void runGateCheck();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [runGateCheck]);

  // Confirm the running bundle booted healthily (promotes a pending OTA bundle to
  // confirmed, arming native crash-rollback). Reaching a resolved, rendered state
  // (login/onboarding/main — not the loading splash) is the health signal: a
  // bundle that crashes at module-eval or first render never gets here, so it is
  // auto-rolled-back on the next boot. No-op if nothing is pending / on iOS.
  useEffect(() => {
    if (appState !== 'loading') {
      void confirmBootHealthy();
    }
  }, [appState]);

  // The login screen renders outside the NavigationContainer, so capture its
  // view explicitly (the onStateChange listener only covers in-container routes).
  useEffect(() => {
    if (appState === 'login') {
      analytics.setScreen('Login');
      analytics.track('screen_view', { screen: 'Login' });
    }
  }, [appState]);

  const handleNavReady = useCallback(() => {
    const current = navigationRef.getCurrentRoute()?.name;
    routeNameRef.current = current;
    analytics.setScreen(current);
    if (current) {
      analytics.track('screen_view', { screen: current });
      recordNavBreadcrumb(current);
    }
  }, []);

  const handleNavStateChange = useCallback(() => {
    const previous = routeNameRef.current;
    const current = navigationRef.getCurrentRoute()?.name;
    if (current && current !== previous) {
      routeNameRef.current = current;
      analytics.setScreen(current);
      analytics.track('screen_view', { screen: current, prev: previous });
      recordNavBreadcrumb(current);
    }
  }, []);

  const clearAuthenticatedState = useCallback(() => {
    useUserStore.getState().clearUserData();
    usePlacesStore.getState().clearPlacesData();
    // Also drop venue + notification state, else the next user who logs in sees
    // the previous user's stale venue banner / unread badge.
    useCurrentZoneStore.getState().reset();
    useNotificationsStore.getState().reset();
  }, []);

  const checkAppState = useCallback(async () => {
    try {
      const [completedFlag, authenticated] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING.COMPLETED),
        bootstrapSession(),
      ]);

      const hasCompletedOnboarding = completedFlag === 'true';

      if (hasCompletedOnboarding && authenticated) {
        setSessionAuthenticated(true);
        void useUserStore.getState().ensureUserDataLoaded();
        setAppState('main');
        return;
      }

      if (hasCompletedOnboarding) {
        setSessionAuthenticated(false);
        clearAuthenticatedState();
        setAppState('login');
        return;
      }

      setSessionAuthenticated(false);
      clearAuthenticatedState();
      setAppState('onboarding');
    } catch {
      setSessionAuthenticated(false);
      clearAuthenticatedState();
      setAppState('onboarding');
    }
  }, [bootstrapSession, clearAuthenticatedState, setSessionAuthenticated]);

  useEffect(() => {
    void checkAppState();
  }, [checkAppState]);

  const handleLogout = useCallback(() => {
    analytics.track('logout');
    analytics.flush();
    setSessionAuthenticated(false);
    clearAuthenticatedState();
    setAppState('login');
  }, [clearAuthenticatedState, setSessionAuthenticated]);

  const handleOnboardingComplete = useCallback(() => {
    analytics.track('onboarding_completed');
    analytics.identify();
    setSessionAuthenticated(true);
    void useUserStore.getState().ensureUserDataLoaded();
    setAppState('main');
  }, [setSessionAuthenticated]);

  const handleLoginSuccess = useCallback(() => {
    analytics.track('login_success');
    analytics.identify();
    setSessionAuthenticated(true);
    void useUserStore.getState().ensureUserDataLoaded();
    setAppState('main');
  }, [setSessionAuthenticated]);

  // Hard gate wins over every other state, including loading — once the server
  // says this build is unsupported, nothing else is reachable until they update.
  if (updateGate) {
    return <UpdateRequiredScreen config={updateGate} />;
  }

  // Maintenance blocks every non-admin, and like the version gate it outranks
  // `loading` so a blocked user never glimpses the app. A forced store update
  // still beats it above: if the build must go to the store, that is the more
  // useful thing to tell them.
  //
  // Note `checkAppState()` keeps running behind this screen — only the render is
  // replaced — so `appState` still resolves and confirmBootHealthy() still fires.
  // That matters: an OTA bundle whose users all land here must still be judged
  // healthy, or it would be rolled back on the next boot.
  if (maintenanceGate) {
    // The admin door: render the real login screen through the gate, then
    // re-check. An admin passes; anyone else lands straight back here.
    if (adminLoginRequested) {
      return (
        <LoginScreen
          onLoginSuccess={() => {
            handleLoginSuccess();
            // Leave the detour straight away so the re-check happens behind the
            // maintenance screen rather than behind a second login screen.
            setAdminLoginRequested(false);
            void runGateCheck();
          }}
        />
      );
    }
    return (
      <MaintenanceScreen
        info={maintenanceGate}
        onRetry={runGateCheck}
        onAdminSignIn={() => setAdminLoginRequested(true)}
      />
    );
  }

  if (appState === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-[#000000]">
        <AnimatedLogo size={92} motion="pulse" variant="white" showRing={false} />
        <Text className="mt-5 font-ui text-sm text-[#B8AF9E]">
          Preparing your journey...
        </Text>
      </View>
    );
  }

  if (appState === 'login') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={handleNavReady}
      onStateChange={handleNavStateChange}>
      {appState === 'onboarding' ? (
        <OnboardingCallbackProvider
          value={{ onOnboardingComplete: handleOnboardingComplete }}
        >
          <OnboardingNavigator />
        </OnboardingCallbackProvider>
      ) : (
        <MainNavigation onLogout={handleLogout} />
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
