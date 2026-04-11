import React, { useEffect, useRef } from 'react';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import TabNavigation from './TabNavigation';
import Permissions from '../screens/Main/PermissionsScreen';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ARExperienceScreen from '../screens/Main/ARExperienceScreen';
import LensScreen from '../screens/Lens/LensScreen';
import TourListScreen from '../screens/Main/TourListScreen';
import TourDetailScreen from '../screens/Main/TourDetailScreen';
import PurchaseScreen from '../screens/Main/PurchaseScreen';
import { ROUTES } from '../core/constants';
import type { MainStackParamList } from '../core/types';
import { getMyPremiumPass } from '../utils/api/premium';

const Stack = createNativeStackNavigator<MainStackParamList>();

interface MainNavigationProps {
  onLogout: () => void;
}

/**
 * Main navigation stack for authenticated users
 * Contains the tab navigator and modal screens
 */
const MainNavigation: React.FC<MainNavigationProps> = ({ onLogout }) => {
  const navigationRef = useRef<NativeStackNavigationProp<MainStackParamList> | null>(null);
  const promptedRef = useRef(false);

  useEffect(() => {
    if (promptedRef.current) return;
    promptedRef.current = true;
    let cancelled = false;
    (async () => {
      const result = await getMyPremiumPass();
      if (cancelled) return;
      const active = result.success && Boolean(result.data.pass?.is_active);
      if (!active && navigationRef.current) {
        navigationRef.current.navigate(ROUTES.MAIN.PURCHASE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack.Navigator
      initialRouteName={ROUTES.MAIN.TABS}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name={ROUTES.MAIN.TABS}>
        {props => {
          navigationRef.current = props.navigation;
          return <TabNavigation {...props} onLogout={onLogout} />;
        }}
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
      <Stack.Screen
        name={ROUTES.MAIN.TOUR_LIST}
        component={TourListScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.TOUR_DETAIL}
        component={TourDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.PURCHASE}
        component={PurchaseScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigation;
