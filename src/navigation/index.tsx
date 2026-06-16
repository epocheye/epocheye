import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigation from './MainNavigation';
import LoginScreen from '../screens/Auth/LoginScreen';
import { ROUTES, STORAGE_KEYS } from '../core/constants';
import type { LinkingOptions } from '@react-navigation/native';
import type { MainStackParamList } from '../core/types/navigation.types';
import AnimatedLogo from '../components/ui/AnimatedLogo';
import { OnboardingCallbackProvider } from '../context/OnboardingCallbackContext';
import { useSessionStore } from '../stores/sessionStore';
import { useUserStore } from '../stores/userStore';
import { usePlacesStore } from '../stores/placesStore';

type AppState = 'loading' | 'onboarding' | 'login' | 'main';

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
  const bootstrapSession = useSessionStore(state => state.bootstrapSession);
  const setSessionAuthenticated = useSessionStore(
    state => state.setAuthenticated,
  );

  const clearAuthenticatedState = useCallback(() => {
    useUserStore.getState().clearUserData();
    usePlacesStore.getState().clearPlacesData();
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
    setSessionAuthenticated(false);
    clearAuthenticatedState();
    setAppState('login');
  }, [clearAuthenticatedState, setSessionAuthenticated]);

  const handleOnboardingComplete = useCallback(() => {
    setSessionAuthenticated(true);
    void useUserStore.getState().ensureUserDataLoaded();
    setAppState('main');
  }, [setSessionAuthenticated]);

  const handleLoginSuccess = useCallback(() => {
    setSessionAuthenticated(true);
    void useUserStore.getState().ensureUserDataLoaded();
    setAppState('main');
  }, [setSessionAuthenticated]);

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
    <NavigationContainer linking={linking}>
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
