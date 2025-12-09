/**
 * Authentication API Types
 * Defines the request/response interfaces for auth operations
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessExpires: string;
  accessToken: string;
  generatedAt: string;
  message: string;
  refreshToken: string;
  uid: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_at: string;
  generated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpires: string;
  uid: string;
}

export interface AuthError {
  message: string;
  statusCode: number;
}

export type AuthResult<T> =
  | { success: true; data: T }
  | { success: false; error: AuthError };
