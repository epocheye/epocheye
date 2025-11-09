import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AuthNavigation from './AuthNavigation';
// import MainNavigator from './MainNavigator';

const AppNavigator: React.FC = () => {
  const isLoggedIn: boolean = false; // Replace with actual authentication logic

  return (
    <NavigationContainer>
      <AuthNavigation />
    </NavigationContainer>
  );
};

export default AppNavigator;
