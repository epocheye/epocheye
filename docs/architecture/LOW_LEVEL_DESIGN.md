# EpochEye - Low-Level Design (LLD) Document

## Version History

| Version | Date             | Author            | Description |
| ------- | ---------------- | ----------------- | ----------- |
| 1.0     | January 26, 2026 | Architecture Team | Initial LLD |

---

## 1. Module Specifications

### 1.1 Core Module

---

#### 1.1.1 API Configuration (`src/core/config/api.config.ts`)

**Purpose:**
Centralized API configuration constants that define base URLs, timeouts, and endpoint paths.

**Responsibilities:**

- Define API base URL from environment variables
- Set default timeout values
- Define API endpoint paths

**Dependencies:**

- `@env` (react-native-dotenv)

**Public Interface:**

```typescript
export const API_CONFIG = {
  BASE_URL: string;
  TIMEOUT_MS: number;
  ENDPOINTS: {
    AUTH: {
      LOGIN: string;
      SIGNUP: string;
      REFRESH: string;
    };
    PLACES: {
      FIND: string;
      SAVE: string;
      UNSAVE: string;
      SAVED: string;
    };
    USER: {
      PROFILE: string;
      STATS: string;
      AVATAR: string;
    };
  };
} as const;
```

**Error Handling:**

- Throws if required environment variables are missing

---

#### 1.1.2 App Configuration (`src/core/config/app.config.ts`)

**Purpose:**
Application-wide configuration constants for features, limits, and behavior.

**Public Interface:**

```typescript
export const APP_CONFIG = {
  // Location tracking
  LOCATION_CHECK_INTERVAL_MS: number;
  API_CALL_COOLDOWN_MS: number;
  SEARCH_RADIUS_METERS: number;
  SEARCH_RADIUS_FALLBACKS: number[];
  SEARCH_LIMIT: number;

  // Token management
  TOKEN_REFRESH_BUFFER_MS: number;

  // UI
  ANIMATION_DURATION_MS: number;
} as const;
```

---

#### 1.1.3 Route Constants (`src/core/constants/routes.ts`)

**Purpose:**
Type-safe route name constants to prevent typos and enable autocomplete.

**Public Interface:**

```typescript
export const ROUTES = {
  // Auth Stack
  AUTH: {
    LANDING: 'Landing',
    LOGIN: 'Login',
    REGISTER: 'Register',
    ONBOARDING: 'OnboardingFlow',
    PERMISSIONS: 'Permissions',
  },
  // Main Stack
  MAIN: {
    TABS: 'MainTabs',
    SITE_DETAIL: 'SiteDetail',
    AR_EXPERIENCE: 'ARExperience',
  },
  // Tab Screens
  TABS: {
    HOME: 'Home',
    EXPLORE: 'Explore',
    CHALLENGES: 'Challenges',
    SAVED: 'Saved',
    SETTINGS: 'Settings',
  },
} as const;
```

---

#### 1.1.4 Storage Keys (`src/core/constants/storage-keys.ts`)

**Purpose:**
Centralized AsyncStorage key constants to prevent key collisions and typos.

**Public Interface:**

```typescript
export const STORAGE_KEYS = {
  // Auth
  ACCESS_TOKEN: '@epocheye/access_token',
  REFRESH_TOKEN: '@epocheye/refresh_token',
  ACCESS_EXPIRES: '@epocheye/access_expires',
  USER_ID: '@epocheye/user_id',

  // Navigation
  NAVIGATION_STATE: '@epocheye/navigation_state',
  LAST_ROUTE: '@epocheye/last_route',

  // Preferences
  USER_PREFERENCES: '@epocheye/user_preferences',
  ONBOARDING_COMPLETE: '@epocheye/onboarding_complete',
} as const;
```

---

### 1.2 Shared API Module

---

#### 1.2.1 HTTP Client Factory (`src/shared/api/client.ts`)

**Purpose:**
Factory functions for creating configured Axios instances.

**Responsibilities:**

- Create base HTTP client with default configuration
- Create authenticated client with token interceptors
- Handle automatic token refresh

**Dependencies:**

- `axios`
- `API_CONFIG`
- Token storage service

**Public Interface:**

```typescript
/**
 * Creates a base Axios instance with default configuration
 */
export function createBaseClient(): AxiosInstance;

/**
 * Creates an authenticated Axios instance with token management
 * Automatically adds Authorization header and handles 401 refresh
 */
export function createAuthenticatedClient(): AxiosInstance;
```

**Implementation Details:**

```typescript
export function createBaseClient(): AxiosInstance {
  return axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

export function createAuthenticatedClient(): AxiosInstance {
  const client = createBaseClient();

  // Request interceptor - add auth token
  client.interceptors.request.use(
    async config => {
      const token = await getValidAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    error => Promise.reject(error),
  );

  // Response interceptor - handle 401 and refresh
  client.interceptors.response.use(
    response => response,
    async error => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return client(error.config);
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}
```

---

#### 1.2.2 Error Handler (`src/shared/api/error-handler.ts`)

**Purpose:**
Standardized API error handling and response formatting.

**Public Interface:**

```typescript
export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
}

export interface ApiResult<T> {
  success: true;
  data: T;
} | {
  success: false;
  error: ApiError;
}

export function createErrorResult(error: unknown): { success: false; error: ApiError };
export function createSuccessResult<T>(data: T): { success: true; data: T };
export function getErrorMessage(error: AxiosError): string;
export function getStatusCode(error: AxiosError): number;
export function isApiError(error: unknown): error is AxiosError;
```

---

### 1.3 Feature Modules

---

#### 1.3.1 Auth Feature (`src/features/auth/`)

##### 1.3.1.1 Auth Types (`src/features/auth/types/auth.types.ts`)

```typescript
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessExpires: string;
  uid: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignupResponse {
  message: string;
  uid: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpires: string;
  uid: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_at: string;
}

export type AuthResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
```

##### 1.3.1.2 Token Storage Service (`src/features/auth/services/token-storage.service.ts`)

**Purpose:**
Secure storage and retrieval of authentication tokens using AsyncStorage.

**Public Interface:**

```typescript
// Token storage
export async function storeTokens(tokens: AuthTokens): Promise<void>;
export async function updateAccessToken(
  accessToken: string,
  accessExpires: string,
): Promise<void>;
export async function clearTokens(): Promise<void>;

// Token retrieval
export async function getTokens(): Promise<AuthTokens | null>;
export async function getAccessToken(): Promise<string | null>;
export async function getRefreshToken(): Promise<string | null>;
export async function getUserId(): Promise<string | null>;

// Token validation
export async function isAccessTokenExpired(): Promise<boolean>;
export async function isAuthenticated(): Promise<boolean>;
```

##### 1.3.1.3 Auth API Service (`src/features/auth/api/auth.api.ts`)

**Purpose:**
API functions for authentication operations.

**Public Interface:**

```typescript
/**
 * Authenticates user with email and password
 */
export async function login(
  credentials: LoginRequest,
): Promise<AuthResult<LoginResponse>>;

/**
 * Registers a new user
 */
export async function signup(
  data: SignupRequest,
): Promise<AuthResult<SignupResponse>>;

/**
 * Refreshes the access token using stored refresh token
 */
export async function refreshAccessToken(): Promise<
  AuthResult<RefreshTokenResponse>
>;

/**
 * Gets a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null>;

/**
 * Logs out the user by clearing tokens
 */
export async function logout(): Promise<void>;
```

##### 1.3.1.4 useAuth Hook (`src/features/auth/hooks/useAuth.ts`)

**Purpose:**
React hook for authentication state and actions.

**Public Interface:**

```typescript
interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  login: (credentials: LoginRequest) => Promise<AuthResult<LoginResponse>>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn;
```

---

#### 1.3.2 Places Feature (`src/features/places/`)

##### 1.3.2.1 Places Types (`src/features/places/types/places.types.ts`)

```typescript
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  city?: string;
  country?: string;
  formatted: string;
  address_line1?: string;
  address_line2?: string;
  categories?: string[];
  distance_meters?: number;
}

export interface SavedPlace {
  id: string;
  place_id: string;
  saved_at: string;
  place_data: Place;
}

export interface FindPlacesRequest {
  latitude: number;
  longitude: number;
  radius_meters: number;
  limit: number;
}

export interface FindPlacesResponse {
  places: Place[];
  total: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
}
```

##### 1.3.2.2 Places API Service (`src/features/places/api/places.api.ts`)

**Purpose:**
API functions for places operations.

**Public Interface:**

```typescript
/**
 * Find nearby places based on location and radius
 */
export async function findPlaces(
  request: FindPlacesRequest,
): Promise<PlacesResult<FindPlacesResponse>>;

/**
 * Save a place to user's saved places
 */
export async function savePlace(
  placeId: string,
  placeData?: Place,
): Promise<PlacesResult<{ message: string }>>;

/**
 * Remove a place from user's saved places
 */
export async function unsavePlace(
  placeId: string,
): Promise<PlacesResult<{ message: string }>>;

/**
 * Get all saved places for the user
 */
export async function getSavedPlaces(): Promise<PlacesResult<SavedPlace[]>>;
```

##### 1.3.2.3 Places Context (`src/features/places/context/PlacesContext.tsx`)

**Purpose:**
Global state management for places data with intelligent geo-tracking.

**Context Value Interface:**

```typescript
interface PlacesContextType {
  // Nearby places state
  nearbyPlaces: Place[];
  isLoadingNearby: boolean;
  nearbyError: string | null;

  // Saved places state
  savedPlaces: SavedPlace[];
  isLoadingSaved: boolean;
  savedError: string | null;

  // Current location
  currentLocation: LocationData | null;

  // Actions
  refreshNearbyPlaces: () => Promise<void>;
  refreshSavedPlaces: () => Promise<void>;
  toggleSavePlace: (placeId: string, placeData?: Place) => Promise<boolean>;
  isPlaceSaved: (placeId: string) => boolean;
  clearPlacesData: () => void;
}
```

##### 1.3.2.4 Geo Utilities (`src/features/places/utils/geo.utils.ts`)

**Purpose:**
Geolocation utility functions.

**Public Interface:**

```typescript
/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number;

/**
 * Validate if a value is a valid coordinate
 */
export function isValidCoordinate(value: number): boolean;

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string;
```

---

#### 1.3.3 User Feature (`src/features/user/`)

##### 1.3.3.1 User Types (`src/features/user/types/user.types.ts`)

```typescript
export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  interests: string[];
  notificationsEnabled: boolean;
  locationTrackingEnabled: boolean;
}

export interface UserStats {
  total_visits: number;
  total_saved: number;
  challenges_completed: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned_at: string;
  icon_url: string;
}

export interface UpdateProfileRequest {
  name?: string;
  preferences?: Partial<UserPreferences>;
}
```

##### 1.3.3.2 User Context (`src/features/user/context/UserContext.tsx`)

**Purpose:**
Global state management for user profile and stats.

**Context Value Interface:**

```typescript
interface UserContextType {
  profile: UserProfile | null;
  stats: UserStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshUserData: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<boolean>;
  uploadAvatar: (imageFile: FormData) => Promise<boolean>;
  clearUserData: () => void;
}
```

---

### 1.4 Design System Module

---

#### 1.4.1 Design Tokens (`src/design-system/tokens/`)

##### Colors (`colors.ts`)

```typescript
export const Colors = {
  // Primary Colors
  primary: '#FFFFFF',
  primaryDark: '#E0E0E0',
  secondary: '#3B82F6',
  secondaryDark: '#2563EB',

  // Background Colors
  background: '#111111',
  backgroundLight: '#1A1A1A',
  backgroundCard: '#222222',
  backgroundInput: '#040404',

  // Text Colors
  text: '#FFFFFF',
  textSecondary: '#888888',
  textTertiary: '#666666',
  textMuted: '#999999',

  // Status Colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // UI Elements
  border: '#333333',
  borderLight: '#444444',
  disabled: '#555555',
  placeholder: '#888888',

  // Transparency
  transparent: 'transparent',
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
} as const;

export type ColorKey = keyof typeof Colors;
```

##### Typography (`typography.ts`)

```typescript
export const FontFamily = {
  regular: 'MontserratAlternates-Regular',
  thin: 'MontserratAlternates-Thin',
  light: 'MontserratAlternates-Light',
  medium: 'MontserratAlternates-Medium',
  semiBold: 'MontserratAlternates-SemiBold',
  bold: 'MontserratAlternates-Bold',
  extraBold: 'MontserratAlternates-ExtraBold',
  black: 'MontserratAlternates-Black',
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const LineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;
```

##### Spacing (`spacing.ts`)

```typescript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;
```

---

#### 1.4.2 UI Components (`src/design-system/components/`)

##### Button Component (`Button/Button.tsx`)

**Purpose:**
Reusable button component with multiple variants and states.

**Props Interface:**

```typescript
interface ButtonProps {
  /** Button label text */
  title: string;
  /** Press handler */
  onPress: () => void;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Disabled state */
  disabled?: boolean;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Icon element */
  icon?: React.ReactNode;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Custom container style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Accessibility hint */
  accessibilityHint?: string;
}
```

##### Input Component (`Input/Input.tsx`)

**Purpose:**
Reusable text input with label, error state, and icons.

**Props Interface:**

```typescript
interface InputProps extends TextInputProps {
  /** Input label */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Icon on the left side */
  leftIcon?: React.ReactNode;
  /** Icon on the right side */
  rightIcon?: React.ReactNode;
  /** Container style override */
  containerStyle?: ViewStyle;
  /** Input field style override */
  inputStyle?: TextStyle;
  /** Label style override */
  labelStyle?: TextStyle;
  /** Enable password toggle button */
  showPasswordToggle?: boolean;
  /** Mark as required field */
  required?: boolean;
}
```

##### Card Component (`Card/Card.tsx`)

**Purpose:**
Container component for content grouping.

**Props Interface:**

```typescript
interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Padding size */
  padding?: 'none' | 'small' | 'medium' | 'large';
  /** Border radius */
  radius?: 'small' | 'medium' | 'large';
  /** Custom style */
  style?: ViewStyle;
  /** Press handler (makes card touchable) */
  onPress?: () => void;
}
```

---

### 1.5 Navigation Module

---

#### 1.5.1 Navigation Types (`src/navigation/types.ts`)

```typescript
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  OnboardingFlow: undefined;
  Permissions: undefined;
};

// Main Stack
export type MainStackParamList = {
  MainTabs: undefined;
  SiteDetail: { site: Place };
  ARExperience: { site: Place };
  Permissions: undefined;
};

// Tab Navigator
export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Challenges: undefined;
  Saved: undefined;
  Settings: undefined;
};

// Root Navigator
export type RootStackParamList = {
  Auth: AuthStackParamList;
  Main: MainStackParamList;
};

// Navigation prop types
export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type MainNavigationProp = NativeStackNavigationProp<MainStackParamList>;
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;

// Screen props types
export type AuthScreenProps<T extends keyof AuthStackParamList> = {
  navigation: NativeStackNavigationProp<AuthStackParamList, T>;
  route: RouteProp<AuthStackParamList, T>;
};

export type MainScreenProps<T extends keyof MainStackParamList> = {
  navigation: NativeStackNavigationProp<MainStackParamList, T>;
  route: RouteProp<MainStackParamList, T>;
};
```

---

### 1.6 Shared Hooks

---

#### 1.6.1 useDebounce (`src/shared/hooks/useDebounce.ts`)

**Purpose:**
Debounce a value to limit update frequency.

**Public Interface:**

```typescript
/**
 * Returns a debounced version of the provided value
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number): T;
```

**Implementation:**

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

---

#### 1.6.2 useAsync (`src/shared/hooks/useAsync.ts`)

**Purpose:**
Handle async operations with loading and error states.

**Public Interface:**

```typescript
interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseAsyncReturn<T> extends AsyncState<T> {
  execute: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing async operations
 * @param asyncFunction - The async function to execute
 * @param immediate - Whether to execute immediately
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate?: boolean,
): UseAsyncReturn<T>;
```

---

#### 1.6.3 useGeolocation (`src/shared/hooks/useGeolocation.ts`)

**Purpose:**
Manage geolocation state and updates.

**Public Interface:**

```typescript
interface GeolocationState {
  location: LocationData | null;
  error: string | null;
  isLoading: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  getCurrentLocation: () => Promise<LocationData | null>;
  startWatching: () => void;
  stopWatching: () => void;
}

export function useGeolocation(
  options?: GeolocationOptions,
): UseGeolocationReturn;
```

---

### 1.7 Shared Services

---

#### 1.7.1 Storage Service (`src/shared/services/storage.service.ts`)

**Purpose:**
Type-safe AsyncStorage wrapper with error handling.

**Public Interface:**

```typescript
class StorageService {
  /**
   * Store a value with the given key
   */
  static async set<T>(key: string, value: T): Promise<void>;

  /**
   * Retrieve a value by key
   */
  static async get<T>(key: string): Promise<T | null>;

  /**
   * Remove a value by key
   */
  static async remove(key: string): Promise<void>;

  /**
   * Store multiple key-value pairs
   */
  static async multiSet(entries: [string, unknown][]): Promise<void>;

  /**
   * Retrieve multiple values by keys
   */
  static async multiGet<T>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Remove multiple values by keys
   */
  static async multiRemove(keys: string[]): Promise<void>;

  /**
   * Clear all storage
   */
  static async clear(): Promise<void>;
}
```

---

#### 1.7.2 Permission Service (`src/shared/services/permission.service.ts`)

**Purpose:**
Unified permission handling for camera, location, and storage.

**Public Interface:**

```typescript
interface PermissionResult {
  location: boolean;
  camera: boolean;
  storage: boolean;
}

class PermissionService {
  /**
   * Check all required permissions
   */
  static async checkAll(): Promise<PermissionResult>;

  /**
   * Request all required permissions
   */
  static async requestAll(): Promise<PermissionResult>;

  /**
   * Check if all permissions are granted
   */
  static areAllGranted(result: PermissionResult): boolean;

  /**
   * Open device settings
   */
  static async openSettings(): Promise<void>;
}
```

---

## 2. Data Structures

### 2.1 API Response Structures

```typescript
// Generic API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    statusCode: number;
  };
}

// Paginated response
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

### 2.2 Context State Structures

```typescript
// Network context state
interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string | null;
}

// User context state
interface UserState {
  profile: UserProfile | null;
  stats: UserStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

// Places context state
interface PlacesState {
  nearbyPlaces: Place[];
  savedPlaces: SavedPlace[];
  currentLocation: LocationData | null;
  isLoadingNearby: boolean;
  isLoadingSaved: boolean;
  nearbyError: string | null;
  savedError: string | null;
}
```

---

## 3. File Organization

### 3.1 File Naming Conventions

| Type       | Convention                        | Example                        |
| ---------- | --------------------------------- | ------------------------------ |
| Components | PascalCase                        | `Button.tsx`, `UserCard.tsx`   |
| Hooks      | camelCase with `use` prefix       | `useAuth.ts`, `useDebounce.ts` |
| Services   | kebab-case with `.service` suffix | `storage.service.ts`           |
| Types      | kebab-case with `.types` suffix   | `auth.types.ts`                |
| Utilities  | kebab-case with `.utils` suffix   | `geo.utils.ts`                 |
| Constants  | kebab-case                        | `routes.ts`, `storage-keys.ts` |
| Context    | PascalCase with `Context` suffix  | `UserContext.tsx`              |

### 3.2 Index Files

Each module should have an `index.ts` that exports public APIs:

```typescript
// src/features/auth/index.ts
export { login, signup, logout, isAuthenticated } from './api/auth.api';
export { useAuth } from './hooks/useAuth';
export type {
  LoginRequest,
  SignupRequest,
  AuthTokens,
} from './types/auth.types';
```

---

## 4. Error Handling Patterns

### 4.1 API Error Handling

```typescript
// Standard error result creation
function handleApiError(error: unknown): ApiResult<never> {
  if (axios.isAxiosError(error)) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || 'An error occurred',
        statusCode: error.response?.status || 0,
        code: error.code || 'UNKNOWN',
      },
    };
  }

  return {
    success: false,
    error: {
      message: 'An unexpected error occurred',
      statusCode: 0,
      code: 'UNKNOWN',
    },
  };
}
```

### 4.2 Component Error Boundaries

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean }
> {
  // Implementation
}
```

---

## 5. Performance Patterns

### 5.1 Memoization

```typescript
// Memoize expensive calculations
const sortedPlaces = useMemo(() => {
  return [...nearbyPlaces].sort(
    (a, b) => (a.distance_meters || 0) - (b.distance_meters || 0),
  );
}, [nearbyPlaces]);

// Memoize callbacks
const handleToggleSave = useCallback(
  async (placeId: string) => {
    await toggleSavePlace(placeId);
  },
  [toggleSavePlace],
);
```

### 5.2 Lazy Loading

```typescript
// Lazy load screens
const ARExperienceScreen = React.lazy(
  () => import('./screens/ARExperienceScreen'),
);

// With Suspense
<Suspense fallback={<LoadingScreen />}>
  <ARExperienceScreen />
</Suspense>;
```

### 5.3 Throttling/Debouncing

```typescript
// Throttle location updates
const throttledLocationUpdate = useMemo(
  () => throttle(handleLocationUpdate, 5000),
  [handleLocationUpdate],
);

// Debounce search input
const debouncedSearch = useDebounce(searchQuery, 300);
```

---

## 6. Testing Considerations

### 6.1 Testable Patterns

```typescript
// Pure functions are easy to test
export function calculateDistance(lat1, lon1, lat2, lon2): number {
  // Pure calculation, no side effects
}

// Dependency injection for services
class PlacesService {
  constructor(private readonly apiClient: AxiosInstance) {}

  async findNearby(location: Coordinates): Promise<Place[]> {
    // Uses injected client
  }
}
```

### 6.2 Mock Structures

```typescript
// Mock data factories
export const createMockPlace = (overrides?: Partial<Place>): Place => ({
  id: 'mock-place-1',
  name: 'Mock Place',
  lat: 28.6139,
  lon: 77.209,
  formatted: 'Mock Address',
  ...overrides,
});

export const createMockUser = (
  overrides?: Partial<UserProfile>,
): UserProfile => ({
  uid: 'mock-user-1',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  ...overrides,
});
```

---

## 7. Appendix

### 7.1 TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "paths": {
      "@core/*": ["src/core/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@design-system/*": ["src/design-system/*"],
      "@navigation/*": ["src/navigation/*"]
    }
  }
}
```

### 7.2 Import Order Convention

```typescript
// 1. React and React Native
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

// 2. Third-party libraries
import { NavigationContainer } from '@react-navigation/native';
import axios from 'axios';

// 3. Internal absolute imports (using path aliases)
import { Colors, Typography } from '@design-system/tokens';
import { useAuth } from '@features/auth';

// 4. Relative imports
import { HomeCard } from './components/HomeCard';
import { styles } from './Home.styles';

// 5. Types (if separate)
import type { HomeScreenProps } from './Home.types';
```
