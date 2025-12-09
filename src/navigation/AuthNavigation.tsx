import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Landing from '../screens/Auth/Landing';
import Login from '../screens/Auth/Login';
import Signup from '../screens/Auth/Signup';
import Permissions from '../screens/Auth/Permissions';
import { OnboardingFlow } from '../screens/Onboarding';

const Stack = createNativeStackNavigator();

interface AuthNavigationProps {
  onLoginSuccess: () => void;
}

const AuthNavigation: React.FC<AuthNavigationProps> = ({ onLoginSuccess }) => {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Landing" component={Landing} />
      <Stack.Screen name="Login">
        {props => <Login {...props} onLoginSuccess={onLoginSuccess} />}
      </Stack.Screen>
      <Stack.Screen name="Register" component={Signup} />
      <Stack.Screen
        name="OnboardingFlow"
        component={OnboardingFlow}
        options={{
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen name="Permissions" component={Permissions} />
    </Stack.Navigator>
  );
};

export default AuthNavigation;
