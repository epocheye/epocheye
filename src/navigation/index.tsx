import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer, NavigationState } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AuthNavigation from './AuthNavigation';
import MainNavigation from './MainNavigation';
import { isAuthenticated } from '../utils/api/auth';
import { StorageService } from '../shared/services';
import { STORAGE_KEYS } from '../core/constants';

/**
 * Root navigator component that handles authentication state
 * and persists navigation state across sessions
 */
const AppNavigator: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initialState, setInitialState] = useState<NavigationState | undefined>(
    undefined,
  );
  const navigationRef = useRef<any>(null);

  // Load saved navigation state on mount
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

  const checkAuthStatus = useCallback(async () => {
    try {
      const authenticated = await isAuthenticated();
      setIsLoggedIn(authenticated);
    } catch {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleLoginSuccess = useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
  }, []);

  // Save navigation state on change
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
      {isLoggedIn ? (
        <MainNavigation onLogout={handleLogout} />
      ) : (
        <AuthNavigation onLoginSuccess={handleLoginSuccess} />
      )}
    </NavigationContainer>
  );
};

export default AppNavigator;
