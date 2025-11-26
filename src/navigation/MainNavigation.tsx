import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigation from './TabNavigation';
import Permissions from '../screens/Auth/Permissions';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ARExperienceScreen from '../screens/Main/ARExperienceScreen';

const Stack = createNativeStackNavigator();

const MainNavigation: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="MainTabs">
      <Stack.Screen
        name="MainTabs"
        component={TabNavigation}
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
      <Stack.Screen
        name="SiteDetail"
        component={SiteDetailScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="ARExperience"
        component={ARExperienceScreen}
        options={{
          headerShown: false,
          animation: 'fade',
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigation;
