import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer, NavigationState } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthNavigation from './AuthNavigation';
import MainNavigation from './MainNavigation';
import { isAuthenticated } from '../utils/api/auth';

const NAVIGATION_STATE_KEY = '@epocheye/navigation_state';

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
        const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
        if (savedState) {
          setInitialState(JSON.parse(savedState));
        }
      } catch (error) {
        console.error('Failed to load navigation state:', error);
      }
    };

    loadNavigationState();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const authenticated = await isAuthenticated();
      setIsLoggedIn(authenticated);
    } catch (error) {
      console.error('Error checking auth status:', error);
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
          await AsyncStorage.setItem(
            NAVIGATION_STATE_KEY,
            JSON.stringify(state),
          );
        } catch (error) {
          console.error('Failed to save navigation state:', error);
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
