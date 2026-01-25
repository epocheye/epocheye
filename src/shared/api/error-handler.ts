/**
 * API Error Handler
 * Standardized error handling and response formatting
 */

import { AxiosError } from 'axios';
import { isAxiosError } from './client';
import { ApiError, ApiResult } from '../../core/types';
import { ERROR_MESSAGES } from '../../core/constants';

/**
 * Type guard for API error response data
 */
function hasMessage(data: unknown): data is { message: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as { message: unknown }).message === 'string'
  );
}

/**
 * Extracts a user-friendly error message from an Axios error
 */
export function getErrorMessage(error: AxiosError): string {
  // Check for API error message
  if (error.response?.data && hasMessage(error.response.data)) {
    return error.response.data.message;
  }

  // Handle specific error codes
  switch (error.code) {
    case 'ECONNABORTED':
      return ERROR_MESSAGES.NETWORK.TIMEOUT;
    case 'ERR_NETWORK':
      return ERROR_MESSAGES.NETWORK.NO_CONNECTION;
    default:
      break;
  }

  // Handle HTTP status codes
  if (error.response?.status) {
    switch (error.response.status) {
      case 401:
        return ERROR_MESSAGES.AUTH.SESSION_EXPIRED;
      case 403:
        return ERROR_MESSAGES.AUTH.UNAUTHORIZED;
      case 404:
        return 'Resource not found.';
      case 500:
      case 502:
      case 503:
        return ERROR_MESSAGES.NETWORK.SERVER_ERROR;
      default:
        break;
    }
  }

  return error.message || ERROR_MESSAGES.NETWORK.UNKNOWN;
}

/**
 * Gets the HTTP status code from an Axios error
 */
export function getStatusCode(error: AxiosError): number {
  if (error.response?.status) {
    return error.response.status;
  }

  // Map common error codes to status codes
  switch (error.code) {
    case 'ECONNABORTED':
      return 408; // Request Timeout
    case 'ERR_NETWORK':
      return 0; // Network Error
    default:
      return 0;
  }
}

/**
 * Gets an error code string from an Axios error
 */
export function getErrorCode(error: AxiosError): string {
  return error.code || 'UNKNOWN';
}

/**
 * Creates a standardized error result from any error
 */
export function createErrorResult(error: unknown): {
  success: false;
  error: ApiError;
} {
  if (isAxiosError(error)) {
    return {
      success: false,
      error: {
        message: getErrorMessage(error),
        statusCode: getStatusCode(error),
        code: getErrorCode(error),
      },
    };
  }

  // Handle non-Axios errors
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        message: error.message,
        statusCode: 0,
        code: 'UNKNOWN',
      },
    };
  }

  // Handle unknown error types
  return {
    success: false,
    error: {
      message: ERROR_MESSAGES.NETWORK.UNKNOWN,
      statusCode: 0,
      code: 'UNKNOWN',
    },
  };
}

/**
 * Creates a standardized success result
 */
export function createSuccessResult<T>(data: T): { success: true; data: T } {
  return {
    success: true,
    data,
  };
}

/**
 * Wraps an async operation with standardized error handling
 */
export async function wrapApiCall<T>(
  operation: () => Promise<T>
): Promise<ApiResult<T>> {
  try {
    const data = await operation();
    return createSuccessResult(data);
  } catch (error) {
    return createErrorResult(error);
  }
}
