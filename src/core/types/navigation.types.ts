/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp, CompositeNavigationProp } from '@react-navigation/native';

/**
 * Place type for navigation params (simplified for navigation)
 */
export interface PlaceNavParam {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
  city?: string;
  country?: string;
  formatted?: string;
  heroImages?: string[];
  [key: string]: unknown;
}

/**
 * Onboarding Stack Parameter List
 * 5-screen Figma flow + retained auth/arrival screens:
 * OB00_Splash → OB01_Welcome → OB02_Name → OB03_Region → OB04_Pull
 *   → OB10_SignUp (or OB10_Login) → OB11_Notifications (final; completes onboarding)
 */
export type OnboardingStackParamList = {
  OB00_Splash: undefined;
  OB01_Welcome: undefined;
  OB02_Name: undefined;
  OB03_Region: undefined;
  OB04_Pull: undefined;
  OB10_SignUp: {fromOnboarding?: boolean} | undefined;
  OB10_Login: undefined;
  OB11_Notifications: undefined;
};

/**
 * Main Stack Parameter List
 */
export type MainStackParamList = {
  MainTabs: undefined;
  /**
   * `mode: 'museum'` opens Lens straight into seed-free tap-to-identify.
   * When launched from a site's "View in AR", the site context is passed so the
   * Lens can identify the site and decide whether to show the "AR not available
   * yet" notice (`arReady === false`) before falling back to object detection.
   */
  Lens:
    | {
        mode?: 'museum';
        siteName?: string;
        siteSlug?: string;
        arReady?: boolean;
        lat?: number;
        lon?: number;
      }
    | undefined;
  SiteDetail: { site: PlaceNavParam };
  ARExperience: { site: PlaceNavParam };
  ARComposer: {
    monumentId: string;
    objectLabel: string;
    glbUrl: string;
    thumbnailUrl?: string;
    cached: boolean;
    provider: string;
    quality?: 'none' | 'single_view' | 'multi_view' | string;
    scanCount?: number;
    /** Dev-only: when true, hide heritage context and show generic object info. */
    isTestMode?: boolean;
    testObjectDescription?: string;
  };
  Purchase: { preSelectedPlaceId?: string } | undefined;
  Notifications: undefined;
  History: undefined;
  /** Admin-only: capture geo-anchors for the curated AR catalog. */
  AnchorCapture: undefined;
  /** Site-grounded AI Guide chat. */
  AiGuide: {
    slug: string;
    siteName: string;
    heroImageUrl?: string;
  };
  /**
   * Detector-driven AR. Production: scan an artifact → Roboflow → grounded card
   * + world-anchored model. `devPicker` opens the dev model-picker harness
   * instead (pick a model → auto-place in front, for home testing).
   */
  DetectAr:
    | {
        glbUrl?: string;
        label?: string;
        /** Seeded venue slug for grounded resolution + Gemini-fallback scoping. */
        venueSlug?: string;
        /** DEV: open the model-picker test instead of the detector flow. */
        devPicker?: boolean;
      }
    | undefined;
  /** No-ARCore fallback — render an asset in a 3D orbit/zoom viewer. */
  Ar3dViewer: {
    monumentId: string;
    objectLabel: string;
    glbUrl: string;
    thumbnailUrl?: string;
    knowledgeText?: string;
    /** Human-readable site name shown in the top overlay. Falls back to a slug-derived label. */
    siteName?: string;
    /** Default era subtitle when no era slider applies (e.g. catalog viewer_only callers). */
    defaultEraLabel?: string;
  };
  /** Away-from-venue gate: shown when the user tries to scan outside any venue. */
  GoToVenue: undefined;
};

/**
 * Tab Navigator Parameter List
 * 4-tab layout: Home · Passport · Daily · Account.
 */
export type TabParamList = {
  Home: undefined;
  Passport: undefined;
  Daily: undefined;
  Account: undefined;
};

/**
 * Root Stack Parameter List
 */
export type RootStackParamList = {
  Onboarding: OnboardingStackParamList;
  Main: MainStackParamList;
};

// ============================================
// Navigation Props
// ============================================

export type OnboardingNavigationProp =
  NativeStackNavigationProp<OnboardingStackParamList>;

export type MainNavigationProp =
  NativeStackNavigationProp<MainStackParamList>;

// Drawer-backed: the persistent bottom-tab bar was replaced by a side drawer.
// The `Tab*` names are kept so the destination screens' prop types don't churn;
// `navigation.openDrawer()` is available through these composite props.
export type TabNavigationProp = DrawerNavigationProp<TabParamList>;

export type TabMainNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<TabParamList>,
  NativeStackNavigationProp<MainStackParamList>
>;

// ============================================
// Screen Props
// ============================================

export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, T>;
  route: RouteProp<OnboardingStackParamList, T>;
};

export type MainScreenProps<T extends keyof MainStackParamList> = {
  navigation: NativeStackNavigationProp<MainStackParamList, T>;
  route: RouteProp<MainStackParamList, T>;
};

export type TabScreenProps<T extends keyof TabParamList> = {
  navigation: TabMainNavigationProp;
  route: RouteProp<TabParamList, T>;
};

// ============================================
// Utility Types
// ============================================

export type RouteParams<
  ParamList extends Record<string, object | undefined>,
  RouteName extends keyof ParamList,
> = ParamList[RouteName];
