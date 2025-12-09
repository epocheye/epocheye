import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigation from './TabNavigation';
import Permissions from '../screens/Auth/Permissions';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ARExperienceScreen from '../screens/Main/ARExperienceScreen';

const Stack = createNativeStackNavigator();

interface MainNavigationProps {
  onLogout: () => void;
}

const MainNavigation: React.FC<MainNavigationProps> = ({ onLogout }) => {
  return (
    <Stack.Navigator initialRouteName="MainTabs">
      <Stack.Screen
        name="MainTabs"
        options={{
          headerShown: false,
        }}
      >
        {props => <TabNavigation {...props} onLogout={onLogout} />}
      </Stack.Screen>
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
