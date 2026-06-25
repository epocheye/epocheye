/**
 * Suggestions API module — wraps POST /api/v1/suggestions on the Go backend.
 *
 * Lets a user suggest a place for Epocheye to cover when there's no site near
 * them. No reward and no image upload in this build.
 */

import {createAuthenticatedClient} from '../auth';
import {createErrorResult} from '../helpers';

export interface SuggestPlaceParams {
  placeName: string;
  placeDetails?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlaceSuggestion {
  id: string;
}

export type ApiResult<T> =
  | {success: true; data: T}
  | {success: false; error: {message: string; statusCode: number}};

/** Submit a place suggestion. Returns the created suggestion id on success. */
export async function suggestPlace(
  params: SuggestPlaceParams,
): Promise<ApiResult<PlaceSuggestion>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<PlaceSuggestion>('/api/v1/suggestions', {
      place_name: params.placeName,
      place_details: params.placeDetails ?? '',
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
    });
    return {success: true, data: resp.data};
  } catch (error) {
    return createErrorResult(error);
  }
}
