import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ROUTES} from '../core/constants';
import type {OnboardingStackParamList} from '../core/types/navigation.types';

import OB00_Splash from '../screens/Onboarding/OB00_Splash';
import OB01_Welcome from '../screens/Onboarding/OB01_Welcome';
import OB02_Name from '../screens/Onboarding/OB02_Name';
import OB03_Region from '../screens/Onboarding/OB03_Region';
import SignupScreen from '../screens/Onboarding/SignupScreen';
import OB10_Login from '../screens/Onboarding/OB10_Login';
import OB11_Notifications from '../screens/Onboarding/OB11_Notifications';
import OB12_Arrival from '../screens/Onboarding/OB12_Arrival';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * OnboardingNavigator — 4-screen Figma flow + retained auth/arrival screens.
 * OB00_Splash → OB01_Welcome → OB02_Name → OB03_Region
 *   → OB10_SignUp (or OB10_Login) → OB11_Notifications → OB12_Arrival
 */
const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.ONBOARDING.OB00_SPLASH}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}>
      <Stack.Screen name={ROUTES.ONBOARDING.OB00_SPLASH} component={OB00_Splash} />
      <Stack.Screen name={ROUTES.ONBOARDING.OB01_WELCOME} component={OB01_Welcome} />
      <Stack.Screen name={ROUTES.ONBOARDING.OB02_NAME} component={OB02_Name} />
      <Stack.Screen name={ROUTES.ONBOARDING.OB03_REGION} component={OB03_Region} />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB10_SIGNUP}
        component={SignupScreen}
        initialParams={{fromOnboarding: true}}
      />
      <Stack.Screen name={ROUTES.ONBOARDING.OB10_LOGIN} component={OB10_Login} />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB11_NOTIFICATIONS}
        component={OB11_Notifications}
      />
      <Stack.Screen
        name={ROUTES.ONBOARDING.OB12_ARRIVAL}
        component={OB12_Arrival}
        options={{gestureEnabled: false}}
      />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
