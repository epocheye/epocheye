/**
 * Token Storage Module
 * Handles secure storage and retrieval of authentication tokens using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthTokens } from './types';

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@epocheye/access_token',
  REFRESH_TOKEN: '@epocheye/refresh_token',
  ACCESS_EXPIRES: '@epocheye/access_expires',
  USER_ID: '@epocheye/user_id',
} as const;

/**
 * Stores authentication tokens securely in AsyncStorage
 * @param tokens - The authentication tokens to store
 */
export async function storeTokens(tokens: AuthTokens): Promise<void> {
  try {
    const entries: [string, string][] = [
      [STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken],
      [STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken],
      [STORAGE_KEYS.ACCESS_EXPIRES, tokens.accessExpires],
      [STORAGE_KEYS.USER_ID, tokens.uid],
    ];

    await AsyncStorage.multiSet(entries);
  } catch {
    throw new Error('Failed to store authentication tokens');
  }
}

/**
 * Updates the access token and expiry after a refresh
 * @param accessToken - The new access token
 * @param accessExpires - The new expiry time
 */
export async function updateAccessToken(
  accessToken: string,
  accessExpires: string
): Promise<void> {
  try {
    const entries: [string, string][] = [
      [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
      [STORAGE_KEYS.ACCESS_EXPIRES, accessExpires],
    ];

    await AsyncStorage.multiSet(entries);
  } catch {
    throw new Error('Failed to update access token');
  }
}

/**
 * Retrieves all stored authentication tokens
 * @returns The stored tokens or null if not found
 */
export async function getTokens(): Promise<AuthTokens | null> {
  try {
    const keys = [
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.ACCESS_EXPIRES,
      STORAGE_KEYS.USER_ID,
    ];

    const results = await AsyncStorage.multiGet(keys);

    const [accessToken, refreshToken, accessExpires, uid] = results.map(
      ([, value]) => value
    );

    if (!accessToken || !refreshToken || !accessExpires || !uid) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      accessExpires,
      uid,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves only the access token
 * @returns The access token or null if not found
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Retrieves only the refresh token
 * @returns The refresh token or null if not found
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  } catch {
    return null;
  }
}

/**
 * Retrieves the user ID
 * @returns The user ID or null if not found
 */
export async function getUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
  } catch {
    return null;
  }
}

/**
 * Checks if the access token has expired
 * @returns True if expired or not found, false otherwise
 */
export async function isAccessTokenExpired(): Promise<boolean> {
  try {
    const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_EXPIRES);

    if (!expiresAt) {
      return true;
    }

    const expiryDate = new Date(expiresAt);
    const now = new Date();

    // Add a 60-second buffer to account for network latency
    const bufferMs = 60 * 1000;
    return now.getTime() >= expiryDate.getTime() - bufferMs;
  } catch {
    return true;
  }
}

/**
 * Clears all stored authentication tokens (for logout)
 */
export async function clearTokens(): Promise<void> {
  try {
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch {
    throw new Error('Failed to clear authentication tokens');
  }
}

/**
 * Checks if user is authenticated (has valid tokens stored)
 * @returns True if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens !== null;
}
