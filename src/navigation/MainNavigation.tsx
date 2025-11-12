import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '../screens/Main/Home';
import Permissions from '../screens/Auth/Permissions';

const Stack = createNativeStackNavigator();

const MainNavigation: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen
        name="Home"
        component={Home}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Permissions"
        component={Permissions}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigation;
