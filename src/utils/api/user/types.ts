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
}

/**
 * Personalized historical fact generated for a user.
 */
export interface PersonalizedFact {
  id: string;
  headline: string;
  summary: string;
  detail?: string;
  monument?: string;
}

/**
 * Response payload for personalized facts endpoint.
 */
export interface PersonalizedFactsResponse {
  facts: PersonalizedFact[];
}

/**
 * Request payload for fact elaboration endpoint.
 */
export interface ElaborateFactRequest {
  factId: string;
  headline: string;
  summary: string;
  userName?: string;
  nearbyPlaceName?: string;
}

/**
 * Elaborated detail response for a fact.
 */
export interface ElaboratedFact {
  id: string;
  detail: string;
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
