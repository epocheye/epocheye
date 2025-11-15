import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AuthNavigation from './AuthNavigation';
import MainNavigation from './MainNavigation';
// import MainNavigator from './MainNavigator';

const AppNavigator: React.FC = () => {
  const isLoggedIn: boolean = true; // Replace with actual authentication logic

  return (
    <NavigationContainer>
      {isLoggedIn ? <MainNavigation /> : <AuthNavigation />}
    </NavigationContainer>
  );
};

export default AppNavigator;
