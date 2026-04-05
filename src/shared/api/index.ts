/**
 * Shared API Exports
 * Centralized exports for API infrastructure
 */

// Client factory
export {
  createBaseClient,
  isAxiosError,
  createRequestConfig,
  baseClient,
} from './client';

// Error handling
export {
  getErrorMessage,
  getStatusCode,
  getErrorCode,
  createErrorResult,
  createSuccessResult,
  wrapApiCall,
} from './error-handler';

// Gemini direct client helpers
export {
  generateGeminiText,
  runGeminiHealthCheck,
  streamGeminiText,
} from './gemini.client';
export type { GeminiHealthCheckResult } from './gemini.client';
