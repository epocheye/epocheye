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
 * 4-screen Figma flow + retained auth/arrival screens:
 * OB00_Splash → OB01_Welcome → OB02_Name → OB03_Region
 *   → OB10_SignUp (or OB10_Login) → OB11_Notifications → OB12_Arrival
 */
export type OnboardingStackParamList = {
  OB00_Splash: undefined;
  OB01_Welcome: undefined;
  OB02_Name: undefined;
  OB03_Region: undefined;
  OB10_SignUp: {fromOnboarding?: boolean} | undefined;
  OB10_Login: undefined;
  OB11_Notifications: undefined;
  OB12_Arrival: undefined;
};

/**
 * Main Stack Parameter List
 */
export type MainStackParamList = {
  MainTabs: undefined;
  Lens: undefined;
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
};

/**
 * Tab Navigator Parameter List
 */
export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Plan: undefined;
  Saved: undefined;
  Settings: undefined;
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
