/**
 * Places API Module
 * Handles finding nearby places, saving/unsaving places
 */

import { createAuthenticatedClient } from '../auth';
import {
  FindPlacesRequest,
  FindPlacesResponse,
  SavePlaceRequest,
  SavedPlace,
  PlacesResult,
} from './types';
import { createErrorResult } from '../helpers';

/**
 * Find nearby places based on location and radius
 */
export async function findPlaces(
  request: FindPlacesRequest
): Promise<PlacesResult<FindPlacesResponse>> {
  try {
    const client = createAuthenticatedClient();
    const response = await client.post<FindPlacesResponse>('/findplaces', request);
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Save a place to user's saved places
 */
export async function savePlace(
  placeId: string,
  placeData?: any
): Promise<PlacesResult<{ message: string }>> {
  try {
    const client = createAuthenticatedClient();
    const request: SavePlaceRequest = { 
      place_id: placeId,
      place_data: placeData 
    };
    console.log('[Places API] savePlace -> POST /api/user/save-place', request);
    const response = await client.post<{ message: string }>(
      '/api/user/save-place',
      request
    );
    console.log('[Places API] savePlace <-', response.status, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[Places API] savePlace error', error);
    return createErrorResult(error);
  }
}

/**
 * Remove a place from user's saved places
 */
export async function unsavePlace(
  placeId: string
): Promise<PlacesResult<{ message: string }>> {
  try {
    const client = createAuthenticatedClient();
    console.log(
      '[Places API] unsavePlace -> DELETE /api/user/save-place/{placeId}',
      placeId
    );
    const response = await client.delete<{ message: string }>(
      `/api/user/save-place/${placeId}`
    );
    console.log('[Places API] unsavePlace <-', response.status, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[Places API] unsavePlace error', error);
    return createErrorResult(error);
  }
}

/**
 * Get all saved places for the user
 */
export async function getSavedPlaces(): Promise<PlacesResult<SavedPlace[]>> {
  try {
    const client = createAuthenticatedClient();
    console.log('[Places API] getSavedPlaces -> GET /api/user/saved-places');
    const response = await client.get<
      | SavedPlace[]
      | { saved_places?: SavedPlace[]; savedPlaces?: SavedPlace[]; data?: SavedPlace[] }
    >('/api/user/saved-places');
    
    console.log('[Places API] getSavedPlaces RAW RESPONSE:', JSON.stringify(response.data, null, 2));
    
    const raw = Array.isArray(response.data)
      ? response.data
      : response.data.saved_places || response.data.savedPlaces || response.data.data || [];
    
    console.log('[Places API] getSavedPlaces RAW ARRAY:', raw.length, 'items');
    
    const normalized = raw.map((saved, index) => {
      const placeData =
        (saved as SavedPlace).place_data ||
        (saved as { place?: SavedPlace['place_data'] }).place ||
        (saved as { placeData?: SavedPlace['place_data'] }).placeData;
      
      console.log(`[Places API] Item ${index}:`, {
        hasPlaceData: !!placeData,
        keys: Object.keys(saved),
        placeDataKeys: placeData ? Object.keys(placeData) : 'none',
      });
      
      return placeData ? { ...saved, place_data: placeData } : saved;
    });
    
    console.log('[Places API] getSavedPlaces NORMALIZED:', normalized.length, 'items');
    return { success: true, data: normalized };
  } catch (error) {
    console.error('[Places API] getSavedPlaces error', error);
    return createErrorResult(error);
  }
}
