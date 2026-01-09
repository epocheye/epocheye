/**
 * Places API Types
 * Type definitions for places-related API operations
 */

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance_meters: number;
  formatted: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  street: string;
  categories: string[];
}

export interface FindPlacesRequest {
  latitude: number;
  longitude: number;
  radius_meters: number;
  limit: number;
}

export interface FindPlacesResponse {
  generated_at: string;
  places: Place[];
}

export interface SavePlaceRequest {
  place_id: string;
}

export interface SavedPlace {
  id: string;
  place_id: string;
  place_data: Place;
  saved_at: string;
}

export interface PlacesError {
  message: string;
  statusCode: number;
}

export type PlacesResult<T> =
  | { success: true; data: T }
  | { success: false; error: PlacesError };
