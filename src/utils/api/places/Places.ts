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
    const client = await createAuthenticatedClient();
    const response = await client.post<FindPlacesResponse>(
      '/api/findplaces',
      request
    );
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
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
    const client = await createAuthenticatedClient();
    const request: SavePlaceRequest = { place_id: placeId };
    const response = await client.post<{ message: string }>(
      '/api/user/save-place',
      request
    );
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
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
    const client = await createAuthenticatedClient();
    const response = await client.delete<{ message: string }>(
      `/api/user/save-place/${placeId}`
    );
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
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
    const client = await createAuthenticatedClient();
    const response = await client.get<SavedPlace[]>(
      '/api/user/save-places'
    );
    return { success: true, data: response.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    return {
      success: false,
      error: {
        message: getErrorMessage(axiosError),
        statusCode: getStatusCode(axiosError),
      },
    };
  }
}
