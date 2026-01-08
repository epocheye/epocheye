/**
 * User API Module Exports
 * Centralized exports for all user-related functionality
 */

// Profile API functions
export { getUserProfile, updateUserProfile, uploadAvatar } from './Profile';

// Stats API functions
export { getUserStats } from './Stats';

// Types
export type {
  UserProfile,
  UpdateProfileRequest,
  AvatarUploadResponse,
  UserStats,
  UserError,
  UserResult,
} from './types';
