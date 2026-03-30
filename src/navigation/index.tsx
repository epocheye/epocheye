import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer, NavigationState } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigation from './MainNavigation';
import LoginScreen from '../screens/Auth/LoginScreen';
import { isAuthenticated } from '../utils/api/auth';
import { StorageService } from '../shared/services';
import { STORAGE_KEYS } from '../core/constants';
import { COLORS } from '../core/constants/theme';
import { usePlaces } from '../context';
import { OnboardingCallbackProvider } from '../context/OnboardingCallbackContext';

/**
 * Three-state root navigator:
 * - 'onboarding': First-time user. Shows OnboardingNavigator.
 * - 'login': Returning user whose tokens expired. Shows LoginScreen.
 * - 'main': Authenticated user. Shows MainNavigation.
 */
type AppState = 'loading' | 'onboarding' | 'login' | 'main';

const AppNavigator: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [initialNavState, setInitialNavState] = useState<
    NavigationState | undefined
  >(undefined);
  const navigationRef = useRef<any>(null);
  const { setAuthenticated } = usePlaces();

  useEffect(() => {
    const loadNavigationState = async () => {
      try {
        const savedState = await StorageService.get<NavigationState>(
          STORAGE_KEYS.NAVIGATION.STATE,
        );
        if (savedState) {
          setInitialNavState(savedState);
        }
      } catch {
        // Navigation state loading failed silently
      }
    };

    loadNavigationState();
  }, []);

  const checkAppState = useCallback(async () => {
    try {
      const [onboardingComplete, authenticated] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING.COMPLETED),
        isAuthenticated(),
      ]);

      const hasCompletedOnboarding = onboardingComplete === 'true';

      if (hasCompletedOnboarding && authenticated) {
        // Fully authenticated returning user → skip straight to main app
        setAuthenticated(true);
        setAppState('main');
      } else if (hasCompletedOnboarding && !authenticated) {
        // Returning user whose tokens expired → show login screen only
        setAuthenticated(false);
        setAppState('login');
      } else {
        // First-time user → show full onboarding
        setAuthenticated(false);
        setAppState('onboarding');
      }
    } catch {
      setAuthenticated(false);
      setAppState('onboarding');
    }
  }, [setAuthenticated]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  const handleLogout = useCallback(() => {
    // After logout, returning users see the login screen (not re-onboarding)
    setAuthenticated(false);
    setAppState('login');
  }, [setAuthenticated]);

  // Called by OB12_Arrival when onboarding completes
  const handleOnboardingComplete = useCallback(() => {
    setAuthenticated(true);
    setAppState('main');
  }, [setAuthenticated]);

  // Called by LoginScreen on successful sign-in
  const handleLoginSuccess = useCallback(() => {
    setAuthenticated(true);
    setAppState('main');
  }, [setAuthenticated]);

  const handleStateChange = useCallback(
    async (state: NavigationState | undefined) => {
      if (state) {
        try {
          await StorageService.set(STORAGE_KEYS.NAVIGATION.STATE, state);
        } catch {
          // Navigation state saving failed silently
        }
      }
    },
    [],
  );

  if (appState === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-[#0A0A0A]">
        <ActivityIndicator size="large" color={COLORS.textPrimary} />
      </View>
    );
  }

  // Returning user login — rendered outside NavigationContainer (no navigation needed)
  if (appState === 'login') {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialNavState}
      onStateChange={handleStateChange}
    >
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
