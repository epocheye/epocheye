/**
 * User Stats API Module
 * Handles user statistics operations
 */

import axios, { AxiosError } from 'axios';
import { baseUrl } from '@env';
import { UserStats, UserResult, UserError } from './types';
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
 * Fetches the current user's statistics
 * @returns UserResult with stats data or error
 */
export async function getUserStats(): Promise<UserResult<UserStats>> {
  try {
    const client = await createAuthenticatedClient();
    const response = await client.get<UserStats>('/api/user/stats');

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
