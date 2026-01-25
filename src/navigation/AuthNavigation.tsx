import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Landing from '../screens/Auth/Landing';
import Login from '../screens/Auth/Login';
import Signup from '../screens/Auth/Signup';
import Permissions from '../screens/Auth/Permissions';
import { OnboardingFlow } from '../screens/Onboarding';
import { ROUTES } from '../core/constants';
import type { AuthStackParamList } from '../core/types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthNavigationProps {
  onLoginSuccess: () => void;
}

/**
 * Authentication navigation stack
 * Handles unauthenticated user flows: landing, login, signup, onboarding
 */
const AuthNavigation: React.FC<AuthNavigationProps> = ({ onLoginSuccess }) => {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.AUTH.LANDING}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name={ROUTES.AUTH.LANDING} component={Landing} />
      <Stack.Screen name={ROUTES.AUTH.LOGIN}>
        {props => <Login {...props} onLoginSuccess={onLoginSuccess} />}
      </Stack.Screen>
      <Stack.Screen name={ROUTES.AUTH.REGISTER} component={Signup} />
      <Stack.Screen
        name={ROUTES.AUTH.ONBOARDING}
        component={OnboardingFlow}
        options={{
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen name={ROUTES.AUTH.PERMISSIONS} component={Permissions} />
    </Stack.Navigator>
  );
};

export default AuthNavigation;
