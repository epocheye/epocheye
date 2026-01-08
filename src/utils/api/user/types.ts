/**
 * User API Types
 * Defines the request/response interfaces for user operations
 */

/**
 * User profile data returned from GET /api/user/profile
 */
export interface UserProfile {
  avatar_url: string;
  created_at: string;
  email: string;
  last_login: string;
  name: string;
  phone: string;
  preferences: Record<string, any>;
  updated_at: string;
  uuid: string;
}

/**
 * Request body for PUT /api/user/profile
 */
export interface UpdateProfileRequest {
  name: string;
  phone: string;
  preferences: Record<string, any>;
}

/**
 * Response from POST /api/user/avatar
 */
export interface AvatarUploadResponse {
  additionalProp1?: string;
  additionalProp2?: string;
  additionalProp3?: string;
  [key: string]: string | undefined;
}

/**
 * User statistics data from GET /api/user/stats
 */
export interface UserStats {
  badges: number;
  challenges: {
    pending: number;
    progress_by_status: Record<string, number>;
    total: number;
  };
}

/**
 * Generic result type for user API operations
 */
export interface UserError {
  message: string;
  statusCode: number;
}

export type UserResult<T> =
  | { success: true; data: T }
  | { success: false; error: UserError };
