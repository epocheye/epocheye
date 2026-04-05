/**
 * Shared Module Exports
 * Centralized exports for all shared modules
 */

// API infrastructure
export {
  createBaseClient,
  isAxiosError,
  createRequestConfig,
  baseClient,
  getErrorMessage,
  getStatusCode,
  getErrorCode,
  createErrorResult,
  createSuccessResult,
  wrapApiCall,
} from './api';

// Services
export {
  StorageService,
  PermissionService,
  resolveSubjectImage,
  getResolvedSubjectImageFromCache,
  clearResolvedSubjectImageCache,
} from './services';
export type {
  PermissionResult,
  PermissionName,
  ResolveSubjectImageParams,
  ResolveSubjectImageResponse,
} from './services';

// Hooks
export {
  useDebounce,
  useAsync,
  useGeolocation,
  useMounted,
  useResolvedSubjectImage,
} from './hooks';
export type {
  AsyncState,
  UseAsyncReturn,
  GeolocationOptions,
  GeolocationState,
  UseGeolocationReturn,
  UseResolvedSubjectImageOptions,
  UseResolvedSubjectImageResult,
} from './hooks';

// Utilities
export {
  // Geo
  calculateDistance,
  isValidCoordinate,
  areValidCoordinates,
  formatDistance,
  isWithinRadius,
  getBoundingBox,
  // Formatters
  formatDate,
  formatRelativeTime,
  formatCompactNumber,
  capitalize,
  truncate,
  formatName,
  formatFileSize,
  // Validators
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
} from './utils';
