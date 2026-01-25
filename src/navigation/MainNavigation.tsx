import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigation from './TabNavigation';
import Permissions from '../screens/Auth/Permissions';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ARExperienceScreen from '../screens/Main/ARExperienceScreen';
import { ROUTES } from '../core/constants';
import type { MainStackParamList } from '../core/types';

const Stack = createNativeStackNavigator<MainStackParamList>();

interface MainNavigationProps {
  onLogout: () => void;
}

/**
 * Main navigation stack for authenticated users
 * Contains the tab navigator and modal screens
 */
const MainNavigation: React.FC<MainNavigationProps> = ({ onLogout }) => {
  return (
    <Stack.Navigator initialRouteName={ROUTES.MAIN.TABS}>
      <Stack.Screen
        name={ROUTES.MAIN.TABS}
        options={{
          headerShown: false,
        }}
      >
        {props => <TabNavigation {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.PERMISSIONS}
        component={Permissions}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.SITE_DETAIL}
        component={SiteDetailScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.AR_EXPERIENCE}
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
