/**
 * Shared Utilities Exports
 * Centralized exports for all utility functions
 */

// Geo utilities
export {
  calculateDistance,
  isValidCoordinate,
  areValidCoordinates,
  formatDistance,
  isWithinRadius,
  getBoundingBox,
} from './geo.utils';

// Formatters
export {
  formatDate,
  formatRelativeTime,
  formatCompactNumber,
  capitalize,
  truncate,
  formatName,
  formatFileSize,
  formatCategory,
  formatPlaceType,
} from './formatters';

// Validators
export {
  isValidEmail,
  validatePassword,
  isEmpty,
  isNotEmpty,
  hasMinLength,
  hasMaxLength,
  isLengthInRange,
  isValidName,
  isValidPhone,
  isValidUrl,
  isNumber,
  isPositiveNumber,
  isInRange,
} from './validators';

export { getPlaceImage, buildSiteDetailData } from './place-presenters';
