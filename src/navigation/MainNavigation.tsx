import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DrawerNavigation from './DrawerNavigation';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import ARExperienceScreen from '../screens/Main/ARExperienceScreen';
import LensScreen from '../screens/Lens/LensScreen';
import ARComposer from '../screens/Lens/ARComposer';
import PurchaseScreen from '../screens/Main/PurchaseScreen';
import HistoryScreen from '../screens/History/HistoryScreen';
import AnchorCaptureScreen from '../screens/Admin/AnchorCaptureScreen';
import Ar3dViewerScreen from '../screens/Main/Ar3dViewerScreen';
import AiGuideScreen from '../screens/Main/AiGuideScreen';
import DetectArScreen from '../screens/Main/DetectArScreen';
import GoToVenueScreen from '../screens/Main/GoToVenueScreen';
import VenueActivationBanner from '../components/VenueActivationBanner';
import { ROUTES } from '../core/constants';
import type { MainStackParamList } from '../core/types';

const Stack = createNativeStackNavigator<MainStackParamList>();

interface MainNavigationProps {
  onLogout: () => void;
}

const MainNavigation: React.FC<MainNavigationProps> = ({ onLogout }) => {
  return (
    <>
    <Stack.Navigator
      initialRouteName={ROUTES.MAIN.TABS}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name={ROUTES.MAIN.TABS}>
        {props => <DrawerNavigation {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.SITE_DETAIL}
        options={{
          animation: 'slide_from_right',
        }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <SiteDetailScreen {...props} />
          </ErrorBoundary>
        )}
      </Stack.Screen>
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
        name={ROUTES.MAIN.AR_COMPOSER}
        component={ARComposer}
        options={{
          animation: 'fade',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.PURCHASE}
        component={PurchaseScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.HISTORY}
        component={HistoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.ANCHOR_CAPTURE}
        component={AnchorCaptureScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.AR_3D_VIEWER}
        component={Ar3dViewerScreen}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.AI_GUIDE}
        component={AiGuideScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.DETECT_AR}
        component={DetectArScreen}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.GO_TO_VENUE}
        component={GoToVenueScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
    <VenueActivationBanner />
    </>
  );
};

export default MainNavigation;
