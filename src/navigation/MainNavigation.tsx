import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigation from './TabNavigation';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import ARExperienceScreen from '../screens/Main/ARExperienceScreen';
import ARComposer from '../screens/Lens/ARComposer';
import PurchaseScreen from '../screens/Main/PurchaseScreen';
import HistoryScreen from '../screens/History/HistoryScreen';
import AnchorCaptureScreen from '../screens/Admin/AnchorCaptureScreen';
import Ar3dViewerScreen from '../screens/Main/Ar3dViewerScreen';
import AiGuideScreen from '../screens/Main/AiGuideScreen';
import DetectArScreen from '../screens/Main/DetectArScreen';
import GoToVenueScreen from '../screens/Main/GoToVenueScreen';
import SuggestSiteScreen from '../screens/Main/SuggestSiteScreen';
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
        {props => <TabNavigation {...props} onLogout={onLogout} />}
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
        name={ROUTES.MAIN.AR_EXPERIENCE}
        options={{
          animation: 'fade',
          presentation: 'fullScreenModal',
        }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <ARExperienceScreen {...props} />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.AR_COMPOSER}
        options={{
          animation: 'fade',
          presentation: 'fullScreenModal',
        }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <ARComposer {...props} />
          </ErrorBoundary>
        )}
      </Stack.Screen>
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
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <Ar3dViewerScreen />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.AI_GUIDE}
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <AiGuideScreen {...props} />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.DETECT_AR}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <DetectArScreen />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.GO_TO_VENUE}
        component={GoToVenueScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.SUGGEST_SITE}
        component={SuggestSiteScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
    <VenueActivationBanner />
    </>
  );
};

export default MainNavigation;
