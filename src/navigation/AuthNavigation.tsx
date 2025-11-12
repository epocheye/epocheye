import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Landing from '../screens/Auth/Landing';
import Login from '../screens/Auth/Login';
import Signup from '../screens/Auth/Signup';
import Permissions from '../screens/Auth/Permissions';

const Stack = createNativeStackNavigator();

const AuthNavigation: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Landing" component={Landing} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Signup} />
      <Stack.Screen name="Permissions" component={Permissions} />
    </Stack.Navigator>
  );
};

export default AuthNavigation;
