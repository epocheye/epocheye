/**
 * HTTP Client Factory
 * Factory functions for creating configured Axios instances
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { API_CONFIG } from '../../core/config';

/**
 * Creates a base Axios instance with default configuration
 * Use this for unauthenticated requests (login, signup, etc.)
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
export function isAxiosError<T = unknown>(
  error: unknown
): error is AxiosError<T> {
  return axios.isAxiosError(error);
}

/**
 * Creates a request config with common options
 */
export function createRequestConfig(
  config: Partial<AxiosRequestConfig> = {}
): AxiosRequestConfig {
  return {
    timeout: API_CONFIG.TIMEOUT_MS,
    ...config,
  };
}

/**
 * Base client instance for simple unauthenticated requests
 */
export const baseClient = createBaseClient();
