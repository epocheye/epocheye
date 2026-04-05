/**
 * Images API Module
 * Handles image resolution and async status polling endpoints.
 */

import { API_CONFIG } from '../../../core/config';
import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ImagesResult,
  ResolveImageAcceptedResponse,
  ResolveImageApiResponse,
  ResolveImageRequest,
  ResolveImageResult,
  ResolveImageStatusResponse,
} from './types';

function isResolveImageResult(value: unknown): value is ResolveImageResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.url === 'string' &&
    typeof candidate.subject === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.cached === 'boolean'
  );
}

function isResolveAcceptedResponse(
  value: unknown,
): value is ResolveImageAcceptedResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.job_id === 'string' && candidate.job_id.length > 0;
}

/**
 * Resolve an image URL for a subject.
 * Backend contract: GET /api/v1/images/resolve with query params subject/context.
 */
export async function resolveImage(
  request: ResolveImageRequest,
): Promise<ImagesResult<ResolveImageApiResponse>> {
  const subject = request.subject.trim();
  const context = request.context?.trim();

  if (!subject) {
    return {
      success: false,
      error: {
        message: 'Image subject is required.',
        statusCode: 400,
      },
    };
  }

  try {
    const client = createAuthenticatedClient();
    const response = await client.get<
      ResolveImageResult | ResolveImageAcceptedResponse
    >(API_CONFIG.ENDPOINTS.IMAGES.RESOLVE, {
      params: {
        subject,
        ...(context ? { context } : {}),
      },
    });

    if (response.status === 202 || isResolveAcceptedResponse(response.data)) {
      const accepted = response.data;
      if (!isResolveAcceptedResponse(accepted)) {
        return {
          success: false,
          error: {
            message: 'Image resolve job was accepted without a valid job id.',
            statusCode: response.status,
          },
        };
      }

      return {
        success: true,
        data: {
          type: 'pending',
          jobId: accepted.job_id,
          status: accepted.status,
        },
      };
    }

    if (!isResolveImageResult(response.data)) {
      return {
        success: false,
        error: {
          message: 'Image resolve response did not include a valid URL.',
          statusCode: response.status,
        },
      };
    }

    return {
      success: true,
      data: {
        type: 'resolved',
        result: response.data,
      },
    };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Poll async image resolve status by job id.
 * Backend contract: GET /api/v1/images/resolve/status?job_id=...
 */
export async function getImageResolveStatus(
  jobId: string,
): Promise<ImagesResult<ResolveImageStatusResponse>> {
  const sanitizedJobId = jobId.trim();

  if (!sanitizedJobId) {
    return {
      success: false,
      error: {
        message: 'Image resolve job id is required.',
        statusCode: 400,
      },
    };
  }

  try {
    const client = createAuthenticatedClient();
    const response = await client.get<ResolveImageStatusResponse>(
      API_CONFIG.ENDPOINTS.IMAGES.RESOLVE_STATUS,
      {
        params: { job_id: sanitizedJobId },
      },
    );

    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
