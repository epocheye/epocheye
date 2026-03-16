import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer, NavigationState } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigation from './MainNavigation';
import { isAuthenticated } from '../utils/api/auth';
import { StorageService } from '../shared/services';
import { STORAGE_KEYS } from '../core/constants';
import { usePlaces } from '../context';
import { OnboardingCallbackProvider } from '../context/OnboardingCallbackContext';

/**
 * Root navigator component.
 * Gates on two conditions:
 * 1. Has the user completed onboarding? (STORAGE_KEYS.ONBOARDING.COMPLETED)
 * 2. Is the user authenticated? (token check)
 *
 * If onboarding incomplete OR not authenticated → OnboardingNavigator
 * If onboarding complete AND authenticated → MainNavigation
 */
const AppNavigator: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initialState, setInitialState] = useState<NavigationState | undefined>(
    undefined,
  );
  const navigationRef = useRef<any>(null);
  const { setAuthenticated } = usePlaces();

  useEffect(() => {
    const loadNavigationState = async () => {
      try {
        const savedState = await StorageService.get<NavigationState>(
          STORAGE_KEYS.NAVIGATION.STATE,
        );
        if (savedState) {
          setInitialState(savedState);
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
      const isLoggedIn = authenticated;

      if (hasCompletedOnboarding && isLoggedIn) {
        setShowOnboarding(false);
        setAuthenticated(true);
      } else {
        setShowOnboarding(true);
        setAuthenticated(false);
      }
    } catch {
      setShowOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  }, [setAuthenticated]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  const handleLogout = useCallback(() => {
    setShowOnboarding(true);
    setAuthenticated(false);
  }, [setAuthenticated]);

  // Called by WorldOpensScreen after the banner animation completes
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    setAuthenticated(true);
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

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#111111] justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialState}
      onStateChange={handleStateChange}
    >
      {showOnboarding ? (
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
