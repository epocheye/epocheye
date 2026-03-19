import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../core/constants/routes';
import type { OnboardingStackParamList } from '../core/types/navigation.types';

import SplashVideoScreen from '../screens/Onboarding/SplashVideoScreen';
import HookScreen from '../screens/Onboarding/HookScreen';
import AncestryInputScreen from '../screens/Onboarding/AncestryInputScreen';
import FirstTasteScreen from '../screens/Onboarding/FirstTasteScreen';
import SignupScreen from '../screens/Onboarding/SignupScreen';
import WelcomeScreen from '../screens/Onboarding/WelcomeScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * OnboardingNavigator — 6-screen first-launch flow.
 * SplashVideo → Hook → AncestryInput → FirstTaste → Signup → Welcome
 * All screens have headers hidden. All transitions use 'fade'.
 */
const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.ONBOARDING.SPLASH_VIDEO}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name={ROUTES.ONBOARDING.SPLASH_VIDEO}
        component={SplashVideoScreen}
      />
      <Stack.Screen name={ROUTES.ONBOARDING.HOOK} component={HookScreen} />
      <Stack.Screen
        name={ROUTES.ONBOARDING.ANCESTRY_INPUT}
        component={AncestryInputScreen}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.FIRST_TASTE}
        component={FirstTasteScreen}
      />
      <Stack.Screen name={ROUTES.ONBOARDING.SIGNUP} component={SignupScreen} />
      <Stack.Screen
        name={ROUTES.ONBOARDING.WELCOME}
        component={WelcomeScreen}
      />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
