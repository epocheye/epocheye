/**
 * API Configuration
 * Centralized API configuration constants
 */

import { baseUrl } from '@env';

const parsedBaseUrl =
  typeof baseUrl === 'string' ? baseUrl.trim().replace(/\/+$/, '') : '';

/**
 * Default API timeout in milliseconds
 */
export const API_TIMEOUT_MS = 30000;

/**
 * API Configuration object containing all API-related settings
 */
export const API_CONFIG = {
  /**
   * Base URL for all API requests
   */
  BASE_URL: parsedBaseUrl,

  /**
   * Default request timeout
   */
  TIMEOUT_MS: API_TIMEOUT_MS,

  /**
   * Default request headers
   */
  HEADERS: {
    CONTENT_TYPE: 'application/json',
    ACCEPT: 'application/json',
  },

  /**
   * API Endpoints
   */
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/login',
      SIGNUP: '/signup',
      REFRESH: '/refresh',
    },
    PLACES: {
      FIND: '/findplaces',
      SAVE: '/api/user/save-place',
      UNSAVE: (placeId: string) => `/api/user/save-place/${placeId}`,
      SAVED: '/api/user/saved-places',
    },
    USER: {
      PROFILE: '/api/user/profile',
      STATS: '/api/user/stats',
      AVATAR: '/api/user/avatar',
      SETTINGS: '/api/user/settings',
    },
  },
} as const;

export type ApiEndpoints = typeof API_CONFIG.ENDPOINTS;
