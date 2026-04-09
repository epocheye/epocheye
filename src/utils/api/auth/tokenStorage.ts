import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthTokens } from './types';
import { STORAGE_KEYS } from '../../../core/constants/storage-keys';

type SessionCache = AuthTokens | null;

let sessionCache: SessionCache = null;
let sessionHydrationPromise: Promise<SessionCache> | null = null;
let hasHydratedSession = false;

function cloneTokens(tokens: AuthTokens | null): AuthTokens | null {
  return tokens ? { ...tokens } : null;
}

function updateSessionCache(tokens: SessionCache): void {
  sessionCache = cloneTokens(tokens);
  hasHydratedSession = true;
}

async function hydrateSessionCache(): Promise<SessionCache> {
  const results = await AsyncStorage.multiGet([
    STORAGE_KEYS.AUTH.ACCESS_TOKEN,
    STORAGE_KEYS.AUTH.REFRESH_TOKEN,
    STORAGE_KEYS.AUTH.ACCESS_EXPIRES,
    STORAGE_KEYS.AUTH.USER_ID,
  ]);

  const [accessToken, refreshToken, accessExpires, uid] = results.map(
    ([, value]) => value,
  );

  if (!accessToken || !refreshToken || !accessExpires || !uid) {
    updateSessionCache(null);
    return null;
  }

  const tokens: AuthTokens = {
    accessToken,
    refreshToken,
    accessExpires,
    uid,
  };

  updateSessionCache(tokens);
  return cloneTokens(tokens);
}

export async function bootstrapAuthSession(): Promise<AuthTokens | null> {
  if (hasHydratedSession) {
    return cloneTokens(sessionCache);
  }

  if (!sessionHydrationPromise) {
    sessionHydrationPromise = hydrateSessionCache().finally(() => {
      sessionHydrationPromise = null;
    });
  }

  return sessionHydrationPromise;
}

export function getCachedTokens(): AuthTokens | null {
  return cloneTokens(sessionCache);
}

/**
 * Stores authentication tokens securely in AsyncStorage
 * @param tokens - The authentication tokens to store
 */
export async function storeTokens(tokens: AuthTokens): Promise<void> {
  try {
    const entries: [string, string][] = [
      [STORAGE_KEYS.AUTH.ACCESS_TOKEN, tokens.accessToken],
      [STORAGE_KEYS.AUTH.REFRESH_TOKEN, tokens.refreshToken],
      [STORAGE_KEYS.AUTH.ACCESS_EXPIRES, tokens.accessExpires],
      [STORAGE_KEYS.AUTH.USER_ID, tokens.uid],
    ];

    await AsyncStorage.multiSet(entries);
    updateSessionCache(tokens);
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
      [STORAGE_KEYS.AUTH.ACCESS_TOKEN, accessToken],
      [STORAGE_KEYS.AUTH.ACCESS_EXPIRES, accessExpires],
    ];

    await AsyncStorage.multiSet(entries);
    updateSessionCache(
      sessionCache
        ? {
            ...sessionCache,
            accessToken,
            accessExpires,
          }
        : null,
    );
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
    if (hasHydratedSession) {
      return cloneTokens(sessionCache);
    }
    return bootstrapAuthSession();
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
    const tokens = await getTokens();
    return tokens?.accessToken ?? null;
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
    const tokens = await getTokens();
    return tokens?.refreshToken ?? null;
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
    const tokens = await getTokens();
    return tokens?.uid ?? null;
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
    const tokens = await getTokens();
    const expiresAt = tokens?.accessExpires;

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
    const keys = Object.values(STORAGE_KEYS.AUTH);
    await AsyncStorage.multiRemove(keys);
    updateSessionCache(null);
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
