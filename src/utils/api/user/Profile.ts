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
  profileData: UpdateProfileRequest,
  currentProfile?: UserProfile | null
): Promise<UserResult<UserProfile>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.put<UserProfile>('/api/user/profile', profileData);

    // Any 2xx here means the update COMMITTED on the server — never report it
    // as a failure. The backend normally returns 200 with the fresh profile;
    // if it returns 204 (no body), fall back to a best-effort re-fetch, and if
    // even that fails we optimistically merge the fields we just sent so a
    // saved change is still surfaced as success.
    if (response.data) {
      return { success: true, data: response.data };
    }

    const refetched = await getUserProfile();
    if (refetched.success) {
      return refetched;
    }

    return {
      success: true,
      data: {
        ...(currentProfile ?? ({} as UserProfile)),
        name: profileData.name,
        phone: profileData.phone,
        preferences: profileData.preferences,
      },
    };
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
