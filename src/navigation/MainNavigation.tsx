import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigation from './TabNavigation';
import Permissions from '../screens/Main/PermissionsScreen';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ARExperienceScreen from '../screens/Main/ARExperienceScreen';
import LensScreen from '../screens/Lens/LensScreen';
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
    <Stack.Navigator
      initialRouteName={ROUTES.MAIN.TABS}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name={ROUTES.MAIN.TABS}>
        {props => <TabNavigation {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.PERMISSIONS}
        component={Permissions}
        options={{
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.SITE_DETAIL}
        component={SiteDetailScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.LENS}
        component={LensScreen}
        options={{
          animation: 'fade',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.AR_EXPERIENCE}
        component={ARExperienceScreen}
        options={{
          animation: 'fade',
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigation;
