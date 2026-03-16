/**
 * Places API Module
 * Handles finding nearby places, saving/unsaving places
 */

import { createAuthenticatedClient } from '../auth';
import {
  FindPlacesRequest,
  FindPlacesResponse,
  Place,
  SavePlaceRequest,
  SavedPlace,
  PlacesResult,
} from './types';
import { createErrorResult } from '../helpers';

/**
 * Find nearby places based on location and radius
 */
export async function findPlaces(
  request: FindPlacesRequest,
): Promise<PlacesResult<FindPlacesResponse>> {
  try {
    const client = createAuthenticatedClient();
    const response = await client.post<FindPlacesResponse>(
      '/findplaces',
      request,
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Save a place to user's saved places.
 * placeData is typed as Place so callers pass a verified shape rather than any.
 */
export async function savePlace(
  placeId: string,
  placeData?: Place,
): Promise<PlacesResult<{ message: string }>> {
  try {
    const client = createAuthenticatedClient();
    const request: SavePlaceRequest = {
      place_id: placeId,
      place_data: placeData,
    };
    const response = await client.post<{ message: string }>(
      '/api/user/save-place',
      request,
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Remove a place from user's saved places
 */
export async function unsavePlace(
  placeId: string,
): Promise<PlacesResult<{ message: string }>> {
  try {
    const client = createAuthenticatedClient();
    const response = await client.delete<{ message: string }>(
      `/api/user/save-place/${placeId}`,
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Get all saved places for the user.
 *
 * The backend may return the array directly or nested under saved_places /
 * savedPlaces / data — we normalise all three shapes here so the rest of the
 * app always deals with a plain SavedPlace[].
 */
export async function getSavedPlaces(): Promise<PlacesResult<SavedPlace[]>> {
  try {
    const client = createAuthenticatedClient();
    const response = await client.get<
      | SavedPlace[]
      | {
          saved_places?: SavedPlace[];
          savedPlaces?: SavedPlace[];
          data?: SavedPlace[];
        }
    >('/api/user/saved-places');

    // Normalise the three response shapes the backend may return
    const raw = Array.isArray(response.data)
      ? response.data
      : response.data.saved_places ||
        response.data.savedPlaces ||
        response.data.data ||
        [];

    // Some API versions nest place details under .place or .placeData instead
    // of the expected .place_data. Normalise to always use place_data so the
    // rest of the app has a single consistent shape to work with.
    const normalized = raw.map(saved => {
      const placeData =
        (saved as SavedPlace).place_data ||
        (saved as { place?: SavedPlace['place_data'] }).place ||
        (saved as { placeData?: SavedPlace['place_data'] }).placeData;

      return placeData ? { ...saved, place_data: placeData } : saved;
    });

    return { success: true, data: normalized };
  } catch (error) {
    return createErrorResult(error);
  }
}
