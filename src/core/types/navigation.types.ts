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
 */
export type OnboardingStackParamList = {
  SplashVideo: undefined;
  EmotionalQuestion: undefined;
  MirrorMoment: { answer: 'yes' | 'no' };
  AncestryInput: undefined;
  FirstTaste: { region: string | null };
  Signup: undefined;
  OnboardingPermissions: undefined;
  WorldOpens: undefined;
};

/**
 * Main Stack Parameter List
 */
export type MainStackParamList = {
  MainTabs: undefined;
  SiteDetail: { site: PlaceNavParam };
  ARExperience: { site: PlaceNavParam };
  NavigationScreen: { site: PlaceNavParam };
  Permissions: undefined;
};

/**
 * Tab Navigator Parameter List
 */
export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Challenges: undefined;
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

/**
 * Onboarding Stack Navigation Prop
 */
export type OnboardingNavigationProp = NativeStackNavigationProp<OnboardingStackParamList>;

/**
 * Main Stack Navigation Prop
 */
export type MainNavigationProp = NativeStackNavigationProp<MainStackParamList>;

/**
 * Tab Navigator Navigation Prop
 */
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;

/**
 * Combined Tab + Main Stack Navigation Prop
 */
export type TabMainNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<MainStackParamList>
>;

// ============================================
// Screen Props
// ============================================

/**
 * Onboarding Screen Props
 */
export type OnboardingScreenProps<T extends keyof OnboardingStackParamList> = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, T>;
  route: RouteProp<OnboardingStackParamList, T>;
};

/**
 * Main Screen Props
 */
export type MainScreenProps<T extends keyof MainStackParamList> = {
  navigation: NativeStackNavigationProp<MainStackParamList, T>;
  route: RouteProp<MainStackParamList, T>;
};

/**
 * Tab Screen Props
 */
export type TabScreenProps<T extends keyof TabParamList> = {
  navigation: TabMainNavigationProp;
  route: RouteProp<TabParamList, T>;
};

// ============================================
// Utility Types
// ============================================

/**
 * Extract route params type from a param list
 */
export type RouteParams<
  ParamList extends Record<string, object | undefined>,
  RouteName extends keyof ParamList
> = ParamList[RouteName];
