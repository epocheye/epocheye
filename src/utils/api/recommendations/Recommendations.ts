import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  RecommendationsResponse,
  RecommendationsResult,
} from './types';

export interface GetRecommendationsOptions {
  limit?: number;
  lat?: number;
  lon?: number;
}

export async function getRecommendations(
  opts: GetRecommendationsOptions = {},
): Promise<RecommendationsResult<RecommendationsResponse>> {
  try {
    const client = createAuthenticatedClient();
    const params: Record<string, string | number> = {};
    if (opts.limit !== undefined) params.limit = opts.limit;
    if (opts.lat !== undefined) params.lat = opts.lat;
    if (opts.lon !== undefined) params.lon = opts.lon;

    const resp = await client.get<RecommendationsResponse>(
      '/api/v1/recommendations/',
      { params },
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
