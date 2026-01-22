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
