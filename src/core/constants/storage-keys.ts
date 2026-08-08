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
    /** Set once the first-run guided product tour has been completed/skipped. */
    TOUR_COMPLETED: `${STORAGE_PREFIX}/tour_completed`,
  },

  /**
   * Cache keys
   */
  CACHE: {
    NEARBY_PLACES: `${STORAGE_PREFIX}/nearby_places_cache`,
    SAVED_PLACES: `${STORAGE_PREFIX}/saved_places_cache`,
    USER_PROFILE: `${STORAGE_PREFIX}/user_profile_cache`,
    GEMINI_IMAGE: `${STORAGE_PREFIX}/gemini_image_cache`,
  },

  /**
   * Tours keys
   */
  TOURS: {
    FREE_TOUR_BANNER_DISMISSED: `${STORAGE_PREFIX}/free_tour_banner_dismissed`,
  },

  /**
   * Lens / AR identification keys
   */
  LENS: {
    GEMINI_DAILY_USAGE: `${STORAGE_PREFIX}/gemini_daily_usage`,
    GEMINI_CACHE: `${STORAGE_PREFIX}/gemini_cache`,
  },

  /**
   * Analytics keys
   */
  ANALYTICS: {
    ANON_ID: `${STORAGE_PREFIX}/analytics_anon_id`,
    QUEUE: `${STORAGE_PREFIX}/analytics_queue`,
  },

  /**
   * Crash / stability diagnostics keys (see src/services/crashJournal.ts)
   */
  DIAGNOSTICS: {
    CRASH_JOURNAL: `${STORAGE_PREFIX}/crash_journal`,
    CRASH_BREADCRUMB: `${STORAGE_PREFIX}/crash_breadcrumb`,
  },

  /**
   * App-update / version-gate keys (see src/utils/api/appConfig)
   */
  UPDATE: {
    /** latest_version the user dismissed the soft "update available" nudge for. */
    OPTIONAL_DISMISSED_VERSION: `${STORAGE_PREFIX}/update_optional_dismissed_version`,
  },

  /**
   * AR capability + experience keys.
   */
  AR: {
    /**
     * Intents whose "AR works differently on this phone" explanation has
     * already been shown, as a JSON string[] of intent names.
     *
     * Only PERMANENT states are recorded here. A fixable state
     * ('arcore-missing') is deliberately never persisted — hiding a one-tap
     * fix behind a seen-flag is a bug dressed as politeness.
     */
    CAPABILITY_NOTICE_SEEN: `${STORAGE_PREFIX}/ar_capability_notice_seen`,
  },

  /**
   * Dev-only harness keys — only read/written from __DEV__ code paths.
   */
  DEV: {
    /** Last ARCore Cloud Anchor ID hosted by the dev harness (host → resolve round trip). */
    CLOUD_ANCHOR_ID: `${STORAGE_PREFIX}/dev_cloud_anchor_id`,
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
  | (typeof STORAGE_KEYS.CACHE)[keyof typeof STORAGE_KEYS.CACHE]
  | (typeof STORAGE_KEYS.TOURS)[keyof typeof STORAGE_KEYS.TOURS]
  | (typeof STORAGE_KEYS.LENS)[keyof typeof STORAGE_KEYS.LENS]
  | (typeof STORAGE_KEYS.ANALYTICS)[keyof typeof STORAGE_KEYS.ANALYTICS]
  | (typeof STORAGE_KEYS.DIAGNOSTICS)[keyof typeof STORAGE_KEYS.DIAGNOSTICS]
  | (typeof STORAGE_KEYS.UPDATE)[keyof typeof STORAGE_KEYS.UPDATE]
  | (typeof STORAGE_KEYS.AR)[keyof typeof STORAGE_KEYS.AR]
  | (typeof STORAGE_KEYS.DEV)[keyof typeof STORAGE_KEYS.DEV];
