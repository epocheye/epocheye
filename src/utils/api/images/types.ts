/**
 * Images API Types
 * Type definitions for image resolver endpoints.
 */

export interface ResolveImageRequest {
  subject: string;
  context?: string;
}

export interface ResolveImageResult {
  cached: boolean;
  source: string;
  subject: string;
  url: string;
}

export interface ResolveImageAcceptedResponse {
  job_id: string;
  status?: string;
}

export interface ResolveImageStatusResponse {
  error?: string;
  result?: ResolveImageResult;
  status: string;
}

export type ResolveImageApiResponse =
  | { type: 'resolved'; result: ResolveImageResult }
  | { type: 'pending'; jobId: string; status?: string };

export interface ImagesError {
  message: string;
  statusCode: number;
}

export type ImagesResult<T> =
  | { success: true; data: T }
  | { success: false; error: ImagesError };
