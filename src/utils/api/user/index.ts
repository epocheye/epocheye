/**
 * User API Module Exports
 * Centralized exports for all user-related functionality
 */

// Profile API functions
export { getUserProfile, updateUserProfile, uploadAvatar } from './Profile';

// Stats API functions
export { getUserStats } from './Stats';

// Personalized facts API functions
export { getPersonalizedFacts, elaboratePersonalizedFact } from './Facts';

// Types
export type {
  UserProfile,
  UpdateProfileRequest,
  AvatarUploadResponse,
  UserStats,
  PersonalizedFact,
  PersonalizedFactsResponse,
  ElaborateFactRequest,
  ElaboratedFact,
  UserError,
  UserResult,
} from './types';
