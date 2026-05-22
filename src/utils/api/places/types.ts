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
  /** Gemini-generated description of the place. */
  description?: string;
  /** Gemini-generated significance (UNESCO, historical importance, etc.). */
  significance?: string;
  /** Gemini-classified place type, e.g. "temple", "fort", "heritage_site". */
  place_type?: string;
  /** Real image URLs from Wikipedia / Gemini enrichment. */
  image_urls?: string[];
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
  place_data?: Place;
}

export interface SavedPlace {
  id: string;
  place_id: string;
  place_data: Place;
  saved_at: string;
}

/**
 * SiteDetail is the curated heritage record served by GET /api/v1/sites/:id.
 * Snake-case keys match the backend `Site` struct in apis/sites/models.go.
 * Optional fields correspond to nullable columns; absent fields are dropped
 * by the server's `omitempty` tags.
 */
export interface SiteDetail {
  id: string;
  name: string;
  normalized_name: string;
  slug?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  era?: string;
  century?: string;
  dynasty?: string;
  founder?: string;
  deity?: string;
  architectural_style?: string;
  unesco_status?: string;
  one_line_description?: string;
  short_description?: string;
  hero_image_url?: string;
  status: 'draft' | 'active' | 'published' | 'archived';
  ar_ready: boolean;
  google_place_id?: string;
  /**
   * Structured curated content (summary, timeline, architecture, narratives,
   * faq, ai_runtime_config, ...). Populated only for sites that have been
   * fully authored. Kept loosely typed for now — see plan #5.
   */
  content?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PlacesError {
  message: string;
  statusCode: number;
}

export type PlacesResult<T> =
  | { success: true; data: T }
  | { success: false; error: PlacesError };
