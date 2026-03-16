import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../core/constants/routes';
import type { OnboardingStackParamList } from '../core/types/navigation.types';

import SplashVideoScreen from '../screens/Onboarding/SplashVideoScreen';
import EmotionalQuestionScreen from '../screens/Onboarding/EmotionalQuestionScreen';
import MirrorMomentScreen from '../screens/Onboarding/MirrorMomentScreen';
import AncestryInputScreen from '../screens/Onboarding/AncestryInputScreen';
import FirstTasteScreen from '../screens/Onboarding/FirstTasteScreen';
import SignupScreen from '../screens/Onboarding/SignupScreen';
import PermissionsScreen from '../screens/Onboarding/PermissionsScreen';
import WorldOpensScreen from '../screens/Onboarding/WorldOpensScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * OnboardingNavigator — dedicated stack for the 8-screen first-launch flow.
 * All screens have headers hidden. SplashVideoScreen is the initial route.
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
      <Stack.Screen
        name={ROUTES.ONBOARDING.EMOTIONAL_QUESTION}
        component={EmotionalQuestionScreen}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.MIRROR_MOMENT}
        component={MirrorMomentScreen}
      />
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
        name={ROUTES.ONBOARDING.PERMISSIONS}
        component={PermissionsScreen}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.WORLD_OPENS}
        component={WorldOpensScreen}
      />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
