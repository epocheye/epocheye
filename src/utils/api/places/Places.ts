/**
 * Places API Module
 * Handles finding nearby places, saving/unsaving places
 */

import { AxiosError } from 'axios';
import { createAuthenticatedClient } from '../auth';
import {
  FindPlacesRequest,
  FindPlacesResponse,
  SavePlaceRequest,
  SavedPlace,
  PlacesResult,
  PlacesError,
} from './types';

/**
 * Extracts error message from axios error
 */
function getErrorMessage(error: AxiosError<{ message?: string }>): string {
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
function getStatusCode(error: AxiosError): number {
  return error.response?.status || (error.code === 'ECONNABORTED' ? 408 : 0);
}

/**
 * Find nearby places based on location and radius
 * @param request - Location and search parameters
 * @returns PlacesResult with found places or error
 */
export async function findPlaces(
  request: FindPlacesRequest
): Promise<PlacesResult<FindPlacesResponse>> {
  try {
    console.log('🔐 [findPlaces] Creating authenticated client...');
    const client = createAuthenticatedClient();
    
    console.log('📤 [findPlaces] Making request to /api/findplaces');
    console.log('📤 [findPlaces] Request payload:', JSON.stringify(request));
    
    const response = await client.post<FindPlacesResponse>(
      '/findplaces',
      request
    );
    
    console.log('✅ [findPlaces] Response received:', {
      status: response.status,
      hasPlaces: !!response.data?.places,
      placesCount: response.data?.places?.length || 0
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    console.error('❌ [findPlaces] Error occurred:', {
      message: getErrorMessage(axiosError),
      statusCode: getStatusCode(axiosError),
      responseData: axiosError.response?.data
    });
    return {
      success: false,
      error: {
        message: getErrorMessage(axiosError),
        statusCode: getStatusCode(axiosError),
      },
    };
  }
}

/**
 * Save a place to user's saved places
 * @param placeId - The ID of the place to save
 * @returns PlacesResult with success status or error
 */
export async function savePlace(
  placeId: string
): Promise<PlacesResult<{ message: string }>> {
  try {
    console.log('💾 [savePlace] Starting save place request...');
    console.log('💾 [savePlace] Place ID:', placeId);
    
    const client = createAuthenticatedClient();
    console.log('💾 [savePlace] Authenticated client created');
    
    const request: SavePlaceRequest = { place_id: placeId };
    console.log('💾 [savePlace] Request payload:', JSON.stringify(request));
    console.log('💾 [savePlace] Endpoint: /user/save-place');
    
    const response = await client.post<{ message: string }>(
      '/user/save-place',
      request
    );
    
    console.log('✅ [savePlace] Success:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    console.error('❌ [savePlace] Error occurred:', {
      message: getErrorMessage(axiosError),
      statusCode: getStatusCode(axiosError),
      responseData: axiosError.response?.data,
      placeId
    });
    return {
      success: false,
      error: {
        message: getErrorMessage(axiosError),
        statusCode: getStatusCode(axiosError),
      },
    };
  }
}

/**
 * Remove a place from user's saved places
 * @param placeId - The ID of the place to unsave
 * @returns PlacesResult with success status or error
 */
export async function unsavePlace(
  placeId: string
): Promise<PlacesResult<{ message: string }>> {
  try {
    console.log('🗑️  [unsavePlace] Starting unsave place request...');
    console.log('🗑️  [unsavePlace] Place ID:', placeId);
    
    const client = createAuthenticatedClient();
    console.log('🗑️  [unsavePlace] Authenticated client created');
    console.log('🗑️  [unsavePlace] Endpoint: /user/save-place/' + placeId);
    
    const response = await client.delete<{ message: string }>(
      `/user/save-place/${placeId}`
    );
    
    console.log('✅ [unsavePlace] Success:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    console.error('❌ [unsavePlace] Error occurred:', {
      message: getErrorMessage(axiosError),
      statusCode: getStatusCode(axiosError),
      responseData: axiosError.response?.data,
      placeId
    });
    return {
      success: false,
      error: {
        message: getErrorMessage(axiosError),
        statusCode: getStatusCode(axiosError),
      },
    };
  }
}

/**
 * Get all saved places for the user
 * @returns PlacesResult with saved places array or error
 */
export async function getSavedPlaces(): Promise<
  PlacesResult<SavedPlace[]>
> {
  try {
    console.log('📋 [getSavedPlaces] Starting get saved places request...');
    
    const client = createAuthenticatedClient();
    console.log('📋 [getSavedPlaces] Authenticated client created');
    console.log('📋 [getSavedPlaces] Endpoint: /user/saved-places');
    
    const response = await client.get<SavedPlace[]>(
      '/user/saved-places'
    );
    
    console.log('✅ [getSavedPlaces] Success:', {
      count: response.data?.length || 0,
      status: response.status
    });
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    console.error('❌ [getSavedPlaces] Error occurred:', {
      message: getErrorMessage(axiosError),
      statusCode: getStatusCode(axiosError),
      responseData: axiosError.response?.data
    });
    return {
      success: false,
      error: {
        message: getErrorMessage(axiosError),
        statusCode: getStatusCode(axiosError),
      },
    };
  }
}
