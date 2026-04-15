/**
 * Authentication API Module
 * Handles login, token refresh, and logout operations
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  AuthResult,
  AuthTokens,
} from './types';
import {
  storeTokens,
  updateAccessToken,
  getRefreshToken,
  isAccessTokenExpired,
  getAccessToken,
  clearTokens,
  bootstrapAuthSession,
} from './tokenStorage';
import {
  createBaseClient,
  getErrorMessage,
  getStatusCode,
  isApiError,
} from '../helpers';

const apiClient: AxiosInstance = createBaseClient();
let authenticatedClient: AxiosInstance | null = null;
let refreshRequestPromise: Promise<AuthResult<RefreshTokenResponse>> | null =
  null;

/**
 * Authenticates user with email and password
 * @param credentials - The login credentials
 * @returns AuthResult with login response or error
 */
export async function login(
  credentials: LoginRequest
): Promise<AuthResult<LoginResponse>> {
  try {
    const response = await apiClient.post<LoginResponse>('/login', credentials);

    const loginResponse = response.data;

    // Store tokens in AsyncStorage
    const tokens: AuthTokens = {
      accessToken: loginResponse.accessToken,
      refreshToken: loginResponse.refreshToken,
      accessExpires: loginResponse.accessExpires,
      uid: loginResponse.uid,
    };

    await storeTokens(tokens);

    return {
      success: true,
      data: loginResponse,
    };
  } catch (error) {
    if (isApiError(error)) {
      return {
        success: false,
        error: {
          message: getErrorMessage(error),
          statusCode: getStatusCode(error),
        },
      };
    }
    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        statusCode: 0,
      },
    };
  }
}

/**
 * Refreshes the access token using the stored refresh token
 * @returns AuthResult with new access token or error
 */
export async function refreshAccessToken(): Promise<
  AuthResult<RefreshTokenResponse>
> {
  if (refreshRequestPromise) {
    return refreshRequestPromise;
  }

  refreshRequestPromise = (async () => {
  try {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      return {
        success: false,
        error: {
          message: 'No refresh token available. Please login again.',
          statusCode: 401,
        },
      };
    }

    const response = await apiClient.post<RefreshTokenResponse>('/refresh', {
      refresh_token: refreshToken,
    });

    const refreshResponse = response.data;

    // Update the access token in storage
    await updateAccessToken(
      refreshResponse.access_token,
      refreshResponse.expires_at
    );

    return {
      success: true,
      data: refreshResponse,
    };
  } catch (error) {
    if (isApiError(error)) {
      const statusCode = getStatusCode(error);
      if (statusCode === 401 || statusCode === 403) {
        await clearTokens();
      }
      return {
        success: false,
        error: {
          message: getErrorMessage(error),
          statusCode,
        },
      };
    }
    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        statusCode: 0,
      },
    };
  }
  })();

  try {
    return await refreshRequestPromise;
  } finally {
    refreshRequestPromise = null;
  }
}

/**
 * Gets a valid access token, refreshing if necessary
 * This is the primary method to use when making authenticated API calls
 * @returns Valid access token or null if authentication failed
 */
export async function getValidAccessToken(): Promise<string | null> {
  await bootstrapAuthSession();

  const isExpired = await isAccessTokenExpired();

  if (isExpired) {
    const refreshResult = await refreshAccessToken();
    if (!refreshResult.success) {
      return null;
    }
    return refreshResult.data.access_token;
  }

  return await getAccessToken();
}

/**
 * Logs out the user by clearing all stored tokens
 */
export async function logout(): Promise<void> {
  await clearTokens();
  // Drop cached FCM token so the next user's device registers a fresh row.
  try {
    const { fcmClearCachedToken } = await import('../../../services/fcmService');
    await fcmClearCachedToken();
  } catch {}
}

/**
 * Creates an authenticated axios instance that automatically handles token refresh
 * @returns Configured axios instance with auth interceptors
 */
export function createAuthenticatedClient(): AxiosInstance {
  if (authenticatedClient) {
    return authenticatedClient;
  }

  const authClient = createBaseClient();

  // Request interceptor to add auth token
  authClient.interceptors.request.use(
    async config => {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        throw new Error('Not authenticated. Please login again.');
      }
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${accessToken}`;
      return config;
    },
    error => Promise.reject(error)
  );

  // Response interceptor to handle 401 errors
  authClient.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;

      // If we get a 401 and haven't retried yet
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        const refreshResult = await refreshAccessToken();

        if (refreshResult.success) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${refreshResult.data.access_token}`;
          return authClient(originalRequest);
        }

        // If refresh failed, clear tokens
        await clearTokens();
        throw new Error('Session expired. Please login again.');
      }

      return Promise.reject(error);
    }
  );

  authenticatedClient = authClient;
  return authClient;
}

/**
 * Makes an authenticated API request
 * @param config - Axios request configuration
 * @returns Axios response
 */
export async function authenticatedRequest<T>(
  config: AxiosRequestConfig
): Promise<T> {
  const client = createAuthenticatedClient();
  const response = await client.request<T>(config);
  return response.data;
}
