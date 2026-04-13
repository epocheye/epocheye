import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../core/constants';
import type { OnboardingStackParamList } from '../core/types/navigation.types';

import OB00_Splash from '../screens/Onboarding/OB00_Splash';
import OB01_Welcome from '../screens/Onboarding/OB01_Welcome';
import OB02_Motivation from '../screens/Onboarding/OB02_Motivation';
import OB03_Frequency from '../screens/Onboarding/OB03_Frequency';
import OB04_Goal from '../screens/Onboarding/OB04_Goal';
import OB05_Region from '../screens/Onboarding/OB05_Region';
import OB06_Name from '../screens/Onboarding/OB06_Name';
import OB07_Promise from '../screens/Onboarding/OB07_Promise';
import OB08_DemoStory from '../screens/Onboarding/OB08_DemoStory';
import OB09_Reaction from '../screens/Onboarding/OB09_Reaction';
import SignupScreen from '../screens/Onboarding/SignupScreen';
import OB10_Login from '../screens/Onboarding/OB10_Login';
import OB11_Notifications from '../screens/Onboarding/OB11_Notifications';
import OB12_Arrival from '../screens/Onboarding/OB12_Arrival';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * OnboardingNavigator — first-launch flow with signup and login branches.
 * OB00_Splash → OB01_Welcome → ... → OB12_Arrival
 * Default: horizontal slide transitions, headers hidden.
 * OB08: cross-fade. OB12: no back gesture.
 */
const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.ONBOARDING.OB00_SPLASH}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB00_SPLASH}
        component={OB00_Splash}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB01_WELCOME}
        component={OB01_Welcome}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB02_MOTIVATION}
        component={OB02_Motivation}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB03_FREQUENCY}
        component={OB03_Frequency}
      />
      <Stack.Screen name={ROUTES.ONBOARDING.OB04_GOAL} component={OB04_Goal} />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB05_REGION}
        component={OB05_Region}
      />
      <Stack.Screen name={ROUTES.ONBOARDING.OB06_NAME} component={OB06_Name} />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB07_PROMISE}
        component={OB07_Promise}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB08_DEMO_STORY}
        component={OB08_DemoStory}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB09_REACTION}
        component={OB09_Reaction}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB10_SIGNUP}
        component={SignupScreen}
        initialParams={{ fromOnboarding: true }}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB10_LOGIN}
        component={OB10_Login}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB11_NOTIFICATIONS}
        component={OB11_Notifications}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB12_ARRIVAL}
        component={OB12_Arrival}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
