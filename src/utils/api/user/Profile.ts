/**
 * User Profile API Module
 * Handles user profile operations (GET, PUT, avatar upload)
 */

import axios, { AxiosError } from 'axios';
import { baseUrl } from '@env';
import {
  UserProfile,
  UpdateProfileRequest,
  AvatarUploadResponse,
  UserResult,
  UserError,
} from './types';
import { createAuthenticatedClient } from '../auth/Login';

const API_TIMEOUT_MS = 30000;

/**
 * Extracts error message from axios error
 */
function getErrorMessage(error: AxiosError<{ message?: string }>): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }

  if (error.code === 'ERR_NETWORK') {
    return 'Network error. Please check your connection.';
  }

  return error.message || 'An unexpected error occurred';
}

/**
 * Gets status code from axios error
 */
function getStatusCode(error: AxiosError): number {
  if (error.response?.status) {
    return error.response.status;
  }

  if (error.code === 'ECONNABORTED') {
    return 408;
  }

  return 0;
}

/**
 * Fetches the current user's profile
 * @returns UserResult with profile data or error
 */
export async function getUserProfile(): Promise<UserResult<UserProfile>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<UserProfile>('/api/user/profile');

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const userError: UserError = {
        message: getErrorMessage(error),
        statusCode: getStatusCode(error),
      };

      return {
        success: false,
        error: userError,
      };
    }

    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        statusCode: 0,
      },
    };
  }
}

/**
 * Updates the current user's profile
 * @param profileData - The profile data to update
 * @returns UserResult with updated profile data or error
 */
export async function updateUserProfile(
  profileData: UpdateProfileRequest
): Promise<UserResult<UserProfile>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.put<UserProfile>(
      '/api/user/profile',
      profileData
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const userError: UserError = {
        message: getErrorMessage(error),
        statusCode: getStatusCode(error),
      };

      return {
        success: false,
        error: userError,
      };
    }

    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        statusCode: 0,
      },
    };
  }
}

/**
 * Uploads a new avatar for the current user
 * @param imageFile - The image file to upload (FormData)
 * @returns UserResult with upload response or error
 */
export async function uploadAvatar(
  imageFile: FormData
): Promise<UserResult<AvatarUploadResponse>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.post<AvatarUploadResponse>(
      '/api/user/avatar',
      imageFile,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const userError: UserError = {
        message: getErrorMessage(error),
        statusCode: getStatusCode(error),
      };

      return {
        success: false,
        error: userError,
      };
    }

    return {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        statusCode: 0,
      },
    };
  }
}
