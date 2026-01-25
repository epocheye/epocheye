/**
 * Common Types
 * Shared TypeScript interfaces and types used across the application
 */

/**
 * Generic API Result type for consistent error handling
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

/**
 * Standard API error structure
 */
export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

/**
 * Coordinates for geolocation
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Location data with timestamp
 */
export interface LocationData extends Coordinates {
  timestamp: number;
}

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Optional type helper (makes all properties optional)
 */
export type Optional<T> = Partial<T>;

/**
 * Deep partial type helper
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Async function type
 */
export type AsyncFunction<T = void> = () => Promise<T>;

/**
 * Callback function type
 */
export type Callback<T = void> = (value: T) => void;
