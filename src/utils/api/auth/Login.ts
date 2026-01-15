/**
 * Authentication API Module
 * Handles login, token refresh, and logout operations
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { baseUrl } from '@env';
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
} from './tokenStorage';

const API_TIMEOUT_MS = 30000;

/**
 * Create axios instance with default configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: baseUrl,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Extracts error message from axios error
 */
function getErrorMessage(error: AxiosError<{ message?: string }>): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }

  if (error.code === 'ERR_NETWORK') {
    return 'Network error. Please check your connection.';
  }

  return error.message || 'An unexpected error occurred';
}

/**
 * Gets status code from axios error
 */
function getStatusCode(error: AxiosError): number {
  if (error.response?.status) {
    return error.response.status;
  }

  if (error.code === 'ECONNABORTED') {
    return 408;
  }

  return 0;
}

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
    if (axios.isAxiosError(error)) {
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
    if (axios.isAxiosError(error)) {
      // If refresh token is invalid, clear all tokens
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
}

/**
 * Gets a valid access token, refreshing if necessary
 * This is the primary method to use when making authenticated API calls
 * @returns Valid access token or null if authentication failed
 */
export async function getValidAccessToken(): Promise<string | null> {
  const isExpired = await isAccessTokenExpired();

  if (isExpired) {
    const refreshResult = await refreshAccessToken();

    if (!refreshResult.success) {
      console.error('Failed to refresh token:', refreshResult.error.message);
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
}

/**
 * Creates an authenticated axios instance that automatically handles token refresh
 * @returns Configured axios instance with auth interceptors
 */
export function createAuthenticatedClient(): AxiosInstance {
  const authClient = axios.create({
    baseURL: baseUrl,
    timeout: API_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Request interceptor to add auth token
  authClient.interceptors.request.use(
    async config => {
      console.log('🔐 [Auth Interceptor] Getting valid access token...');
      const accessToken = await getValidAccessToken();

      if (!accessToken) {
        console.error('❌ [Auth Interceptor] No access token available!');
        throw new Error('Not authenticated. Please login again.');
      }

      console.log('✅ [Auth Interceptor] Access token found, adding to request');
      console.log('📍 [Auth Interceptor] Token preview:', accessToken.substring(0, 20) + '...');
      console.log('🎯 [Auth Interceptor] Request URL:', config.url);
      
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
