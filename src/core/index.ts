/**
 * Core Module Exports
 * Centralized exports for configuration, constants, and types
 */

// Configuration
export { API_CONFIG, API_TIMEOUT_MS, APP_CONFIG } from './config';
export type { ApiEndpoints, AppConfig } from './config';

// Constants
export { ROUTES, STORAGE_KEYS, ERROR_MESSAGES } from './constants';
export type {
  OnboardingRoutes,
  MainRoutes,
  TabRoutes,
  StorageKey,
  ErrorMessageKey,
} from './constants';

// Types
export type {
  ApiResult,
  ApiError,
  PaginatedResponse,
  LoadingState,
  Coordinates,
  LocationData,
  BaseEntity,
  Nullable,
  Optional,
  DeepPartial,
  AsyncFunction,
  Callback,
  PlaceNavParam,
  OnboardingStackParamList,
  MainStackParamList,
  TabParamList,
  RootStackParamList,
  OnboardingNavigationProp,
  MainNavigationProp,
  TabNavigationProp,
  TabMainNavigationProp,
  OnboardingScreenProps,
  MainScreenProps,
  TabScreenProps,
} from './types';
