/**
 * Error Messages
 * Centralized user-facing error messages
 */

export const ERROR_MESSAGES = {
  /**
   * Network errors
   */
  NETWORK: {
    NO_CONNECTION: 'No internet connection. Please check your network.',
    TIMEOUT: 'Request timed out. Please try again.',
    SERVER_ERROR: 'Server error. Please try again later.',
    UNKNOWN: 'An unexpected error occurred.',
  },

  /**
   * Authentication errors
   */
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password.',
    SESSION_EXPIRED: 'Your session has expired. Please login again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    LOGIN_REQUIRED: 'Please login to continue.',
    SIGNUP_FAILED: 'Failed to create account. Please try again.',
    LOGOUT_FAILED: 'Failed to logout. Please try again.',
    TOKEN_REFRESH_FAILED: 'Failed to refresh session. Please login again.',
  },

  /**
   * Validation errors
   */
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
    PASSWORDS_DONT_MATCH: 'Passwords do not match.',
  },

  /**
   * Location errors
   */
  LOCATION: {
    PERMISSION_DENIED: 'Location permission is required for this feature.',
    UNAVAILABLE: 'Unable to get your location. Please try again.',
    TIMEOUT: 'Location request timed out. Please try again.',
    NO_PLACES_FOUND: 'No places found in your area.',
  },

  /**
   * Camera errors
   */
  CAMERA: {
    PERMISSION_DENIED: 'Camera permission is required for this feature.',
    NOT_AVAILABLE: 'Camera is not available on this device.',
    CAPTURE_FAILED: 'Failed to capture image. Please try again.',
  },

  /**
   * Places errors
   */
  PLACES: {
    FETCH_FAILED: 'Failed to fetch nearby places.',
    SAVE_FAILED: 'Failed to save place. Please try again.',
    UNSAVE_FAILED: 'Failed to remove saved place. Please try again.',
  },

  /**
   * Profile errors
   */
  PROFILE: {
    FETCH_FAILED: 'Failed to load profile.',
    UPDATE_FAILED: 'Failed to update profile. Please try again.',
    AVATAR_UPLOAD_FAILED: 'Failed to upload avatar. Please try again.',
  },
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
