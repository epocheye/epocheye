/**
 * Authentication Module Exports
 * Centralized exports for all auth-related functionality
 */

// API functions
export {
  login,
  logout,
  refreshAccessToken,
  getValidAccessToken,
  createAuthenticatedClient,
  authenticatedRequest,
} from './Login';

export { signup } from './Signup';
export type { SignupRequest, SignupResponse } from './Signup';

// Token storage utilities
export {
  storeTokens,
  updateAccessToken,
  getTokens,
  getAccessToken,
  getRefreshToken,
  getUserId,
  isAccessTokenExpired,
  clearTokens,
  isAuthenticated,
} from './tokenStorage';

// Types
export type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  AuthTokens,
  AuthError,
  AuthResult,
} from './types';
