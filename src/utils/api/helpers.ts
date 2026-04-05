/**
 * Shared API Helpers
 * Common error handling utilities for API modules
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { API_CONFIG } from '../../core/config';

export const API_TIMEOUT_MS = API_CONFIG.TIMEOUT_MS;

/**
 * Extracts error message from axios error
 */
export function getErrorMessage(error: AxiosError<{ message?: string }>): string {
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
export function getStatusCode(error: AxiosError): number {
  return error.response?.status || (error.code === 'ECONNABORTED' ? 408 : 0);
}

/**
 * Creates a base axios instance with default configuration
 */
export function createBaseClient(): AxiosInstance {
  return axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT_MS,
    headers: {
      'Content-Type': API_CONFIG.HEADERS.CONTENT_TYPE,
      Accept: API_CONFIG.HEADERS.ACCEPT,
    },
  });
}

/**
 * Type guard to check if error is an Axios error
 */
export function isApiError(error: unknown): error is AxiosError<{ message?: string }> {
  return axios.isAxiosError(error);
}

/**
 * Common error result structure
 */
export interface ApiError {
  message: string;
  statusCode: number;
}

/**
 * Creates a standardized error response
 */
export function createErrorResult(error: unknown): { success: false; error: ApiError } {
  if (isApiError(error)) {
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
