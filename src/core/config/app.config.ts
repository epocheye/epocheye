/**
 * Application Configuration
 * App-wide configuration constants for features, limits, and behavior
 */

/**
 * Application configuration object
 */
export const APP_CONFIG = {
  /**
   * Location Tracking Configuration
   */
  LOCATION: {
    /** Interval for location checks in milliseconds */
    CHECK_INTERVAL_MS: 5000,
    /** Cooldown between API calls in milliseconds */
    API_CALL_COOLDOWN_MS: 60000,
    /** Default search radius in meters */
    SEARCH_RADIUS_METERS: 1000,
    /** Fallback radii for cascading search (1km, 5km, 10km, 20km) */
    SEARCH_RADIUS_FALLBACKS: [1000, 5000, 10000, 20000],
    /** Maximum number of places to fetch */
    SEARCH_LIMIT: 50,
    /** Geolocation timeout in milliseconds */
    GEOLOCATION_TIMEOUT_MS: 15000,
    /** Maximum age of cached location in milliseconds */
    LOCATION_MAX_AGE_MS: 10000,
  },

  /**
   * Token Management Configuration
   */
  TOKEN: {
    /** Buffer time before token expiry to trigger refresh (60 seconds) */
    REFRESH_BUFFER_MS: 60000,
  },

  /**
   * UI Configuration
   */
  UI: {
    /** Default animation duration in milliseconds */
    ANIMATION_DURATION_MS: 300,
    /** Debounce delay for search inputs */
    SEARCH_DEBOUNCE_MS: 300,
    /** Pull-to-refresh cooldown */
    REFRESH_COOLDOWN_MS: 2000,
  },

  /**
   * Permission Request Configuration
   */
  PERMISSIONS: {
    /** Timeout for permission request dialogs */
    REQUEST_TIMEOUT_MS: 15000,
  },

  /**
   * App Information
   */
  APP: {
    NAME: 'EpochEye',
    VERSION: '0.0.1',
    BUNDLE_ID: 'com.epocheye',
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
