/**
 * User Profile API Module
 * Handles user profile operations (GET, PUT, avatar upload)
 */

import {
  UserProfile,
  UpdateProfileRequest,
  AvatarUploadResponse,
  UserResult,
} from './types';
import { createAuthenticatedClient } from '../auth/Login';
import { createErrorResult } from '../helpers';

/**
 * Fetches the current user's profile
 */
export async function getUserProfile(): Promise<UserResult<UserProfile>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<UserProfile>('/api/user/profile');
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Updates the current user's profile
 */
export async function updateUserProfile(
  profileData: UpdateProfileRequest
): Promise<UserResult<UserProfile>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.put<UserProfile>('/api/user/profile', profileData);
    // The backend replies 204 No Content on success (empty body). Re-fetch the
    // fresh profile so callers get the updated record instead of `undefined`
    // (which the store was treating as a failed update).
    if (response.status === 204 || !response.data) {
      return await getUserProfile();
    }
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Uploads a new avatar for the current user
 */
export async function uploadAvatar(
  imageFile: FormData
): Promise<UserResult<AvatarUploadResponse>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.post<AvatarUploadResponse>(
      '/api/user/avatar',
      imageFile,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
