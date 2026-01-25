/**
 * AsyncStorage Key Constants
 * Centralized storage key constants to prevent collisions and typos
 */

/**
 * Prefix for all EpochEye storage keys
 */
const STORAGE_PREFIX = '@epocheye';

/**
 * All AsyncStorage keys used in the application
 */
export const STORAGE_KEYS = {
  /**
   * Authentication keys
   */
  AUTH: {
    ACCESS_TOKEN: `${STORAGE_PREFIX}/access_token`,
    REFRESH_TOKEN: `${STORAGE_PREFIX}/refresh_token`,
    ACCESS_EXPIRES: `${STORAGE_PREFIX}/access_expires`,
    USER_ID: `${STORAGE_PREFIX}/user_id`,
  },

  /**
   * Navigation state keys
   */
  NAVIGATION: {
    STATE: `${STORAGE_PREFIX}/navigation_state`,
    LAST_ROUTE: `${STORAGE_PREFIX}/last_route`,
  },

  /**
   * User preferences keys
   */
  PREFERENCES: {
    USER_PREFERENCES: `${STORAGE_PREFIX}/user_preferences`,
    THEME: `${STORAGE_PREFIX}/theme`,
    NOTIFICATIONS_ENABLED: `${STORAGE_PREFIX}/notifications_enabled`,
  },

  /**
   * Onboarding keys
   */
  ONBOARDING: {
    COMPLETED: `${STORAGE_PREFIX}/onboarding_complete`,
    QUESTIONNAIRE_ANSWERS: `${STORAGE_PREFIX}/questionnaire_answers`,
  },

  /**
   * Cache keys
   */
  CACHE: {
    NEARBY_PLACES: `${STORAGE_PREFIX}/nearby_places_cache`,
    SAVED_PLACES: `${STORAGE_PREFIX}/saved_places_cache`,
    USER_PROFILE: `${STORAGE_PREFIX}/user_profile_cache`,
  },
} as const;

/**
 * Type helper for storage keys
 */
export type StorageKey = 
  | (typeof STORAGE_KEYS.AUTH)[keyof typeof STORAGE_KEYS.AUTH]
  | (typeof STORAGE_KEYS.NAVIGATION)[keyof typeof STORAGE_KEYS.NAVIGATION]
  | (typeof STORAGE_KEYS.PREFERENCES)[keyof typeof STORAGE_KEYS.PREFERENCES]
  | (typeof STORAGE_KEYS.ONBOARDING)[keyof typeof STORAGE_KEYS.ONBOARDING]
  | (typeof STORAGE_KEYS.CACHE)[keyof typeof STORAGE_KEYS.CACHE];
