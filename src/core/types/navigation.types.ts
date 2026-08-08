/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
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
  // `site` is the normal in-app param; `slug` is used by deep links
  // (epocheye://site/<slug>) where only the slug is known.
  SiteDetail: { site?: PlaceNavParam; slug?: string };
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
        /** Guided tour: bypass the venue/GPS gate to show the camera as a preview. */
        tour?: boolean;
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
    /**
     * Render `glbUrl` unconditionally, ignoring the site's era table.
     * Set by callers that have already resolved exactly which model to show —
     * without it a site with era data silently overrides `glbUrl` and can land
     * on "Reconstruction coming soon" instead of the model just passed in.
     */
    preferParamGlb?: boolean;
  };
  /**
   * Explains how AR behaves on THIS phone before the user invests anything, and
   * always routes forward — to AR, to the Play Store, or to the 3D viewer.
   */
  ArCapability: {
    intent: 'detect' | 'reconstruction';
    venueSlug?: string;
    siteName?: string;
  };
  /** Away-from-venue gate: shown when the user tries to scan outside any venue. */
  GoToVenue: undefined;
  /** Suggest-a-place: shown after login when no Epocheye site is within 5km. */
  SuggestSite: undefined;
  /** DEV-only workflow health-check board (screen is only registered in dev builds). */
  DevHealth: undefined;
  /** Admin on-site AR authoring tool: place a reconstruction + save a viewing station. */
  StationAuthoring: undefined;
  /** Prod: guide to a viewing station + world-lock the reconstruction. */
  SiteReconstruction: {venueSlug?: string} | undefined;
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

// Bottom-tab shell with the custom floating gold-pill tab bar (FloatingTabBar).
// Composite props let tab screens also push onto the parent native stack.
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;

export type TabMainNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
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
