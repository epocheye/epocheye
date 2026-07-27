import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigation from './TabNavigation';
import SiteDetailScreen from '../screens/Main/SiteDetailScreen';
import ErrorBoundary from '../components/ui/ErrorBoundary';
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
import DailyNudgeBanner from '../components/DailyNudgeBanner';
import UpdateAvailableBanner from '../components/UpdateAvailableBanner';
import OtaUpdateBanner from '../components/OtaUpdateBanner';
import { ROUTES } from '../core/constants';
import type { MainStackParamList } from '../core/types';

// ADMIN-HARNESS (REMOVE AFTER KONARK)
// Workflow health-check board. Statically imported (was a __DEV__ require) so it
// ships in release for the admin harness; the ENTRY (DevHealthCheckButton) is
// gated on __DEV__ || isAdminUser(), so non-admins can never reach it.
import DevHealthCheckScreen from '../screens/Dev/DevHealthCheckScreen';
// Admin on-site AR authoring tool (site-readiness pipeline). Admin-gated at render.
import StationAuthoringScreen from '../screens/Admin/StationAuthoringScreen';
// Prod site-readiness experience: guide to a station + world-lock the reconstruction.
import SiteReconstructionScreen from '../screens/Main/SiteReconstructionScreen';

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
      {/* freezeOnBlur must stay OFF here: the tabs host Home's Google MapView,
          and freezing/unfreezing a Fabric map while a modal covers it makes
          react-native-maps re-insert markers into an empty native list —
          a hard native crash (seen in production as
          "addViewAt: failed to insert view … IndexOutOfBoundsException"). */}
      <Stack.Screen
        name={ROUTES.MAIN.TABS}
        options={{ freezeOnBlur: false }}>
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
        options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <GoToVenueScreen />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen
        name={ROUTES.MAIN.SUGGEST_SITE}
        options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
      >
        {props => (
          <ErrorBoundary onReset={() => props.navigation.goBack()}>
            <SuggestSiteScreen />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      {/* ADMIN-HARNESS (REMOVE AFTER KONARK) — registered unconditionally so the
          admin harness can reach it in release; the entry button gates access. */}
      <Stack.Screen
        name={ROUTES.MAIN.DEV_HEALTH}
        component={DevHealthCheckScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.STATION_AUTHORING}
        component={StationAuthoringScreen}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name={ROUTES.MAIN.SITE_RECONSTRUCTION}
        component={SiteReconstructionScreen}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
    <VenueActivationBanner />
    <DailyNudgeBanner />
    <UpdateAvailableBanner />
    <OtaUpdateBanner />
    </>
  );
};

export default MainNavigation;
