/**
 * Signup API Module
 * Handles user registration operations
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { baseUrl } from '@env';
import { AuthResult } from './types';

const API_TIMEOUT_MS = 30000;

/**
 * Signup request interface
 */
export interface SignupRequest {
  email: string;
  name: string;
  password: string;
}

/**
 * Signup response interface
 */
export interface SignupResponse {
  message: string;
  uid: string;
}

/**
 * Create axios instance with default configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: baseUrl,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

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
 * Registers a new user
 * @param data - The signup data (email, name, password)
 * @returns AuthResult with signup response or error
 */
export async function signup(
  data: SignupRequest
): Promise<AuthResult<SignupResponse>> {
  try {
    const response = await apiClient.post<SignupResponse>('/signup', data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: {
          message: getErrorMessage(error),
          statusCode: getStatusCode(error),
        },
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
