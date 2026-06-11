/**
 * Places API Module
 * Handles finding nearby places, saving/unsaving places
 */

import { createAuthenticatedClient } from '../auth';
import {
  FindPlacesRequest,
  FindPlacesResponse,
  Place,
  PlaceSearchResult,
  SavePlaceRequest,
  SavedPlace,
  SiteDetail,
  PlacesResult,
} from './types';
import { createErrorResult } from '../helpers';
import { fetchZones } from '../../../services/zoneService';
import type { HeritageZone } from '../../../core/config/geofence.types';

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Maps a curated heritage zone into the Place shape the app already consumes. */
function zoneToPlace(zone: HeritageZone, lat: number, lon: number): Place {
  return {
    id: zone.monument_id,
    name: zone.name,
    lat: zone.lat,
    lon: zone.lon,
    distance_meters: haversineMeters(lat, lon, zone.lat, zone.lon),
    formatted: zone.epochLabel ?? '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postcode: '',
    country: '',
    street: '',
    categories: ['heritage_site'],
    place_type: 'heritage_site',
    significance: zone.epochLabel || undefined,
  };
}

/**
 * "Nearby places" — now sourced from the curated Epocheye venues (heritage zones),
 * NOT the old Geoapify /findplaces search. The app is venue-locked, so the only
 * places that matter are curated venues; this keeps every existing consumer (Home,
 * SiteDetail, Lens, monument detection) working with the same Place shape while
 * pointing them at curated data and retiring the Geoapify dependency on this path.
 */
export async function findPlaces(
  request: FindPlacesRequest,
): Promise<PlacesResult<FindPlacesResponse>> {
  try {
    const zones = await fetchZones(request.latitude, request.longitude);
    const radius = request.radius_meters > 0 ? request.radius_meters : Infinity;
    const limit = request.limit > 0 ? request.limit : 50;
    const places = zones
      .map(z => zoneToPlace(z, request.latitude, request.longitude))
      .filter(p => p.distance_meters <= radius)
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, limit);
    return {
      success: true,
      data: { generated_at: new Date().toISOString(), places },
    };
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

/**
 * Fetch the curated heritage record for a single site.
 *
 * `idOrSlug` may be either the monument UUID (preferred when known) or the
 * URL slug — the backend accepts both. Returns `success: false` with a 404
 * statusCode for places that exist in /findplaces but not in the curated DB,
 * which callers should treat as "no rich metadata available, render bare".
 */
export async function getSite(
  idOrSlug: string,
): Promise<PlacesResult<SiteDetail>> {
  try {
    const client = createAuthenticatedClient();
    const response = await client.get<SiteDetail>(
      `/api/v1/sites/${encodeURIComponent(idOrSlug)}`,
    );
    return { success: true, data: response.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * List all curated heritage sites visible to end users (status active or
 * published). Backed by GET /api/v1/sites and authenticated like the rest of
 * this module.
 */
export async function getSites(): Promise<PlacesResult<SiteDetail[]>> {
  try {
    const client = createAuthenticatedClient();
    const response = await client.get<{ sites?: SiteDetail[] }>(
      '/api/v1/sites',
    );
    const sites = Array.isArray(response.data?.sites)
      ? response.data.sites
      : [];
    return { success: true, data: sites };
  } catch (error) {
    return createErrorResult(error);
  }
}

/**
 * Free-text venue search — now filters the curated Epocheye venues by name (was the
 * Geoapify /findplaces/search). In a venue-locked app, search only needs to find your
 * venues, so this keeps the search bar useful without the external place index.
 */
export async function searchPlaces(
  query: string,
): Promise<PlacesResult<PlaceSearchResult[]>> {
  try {
    const zones = await fetchZones();
    const q = query.trim().toLowerCase();
    const results: PlaceSearchResult[] = (q ? zones.filter(z => z.name.toLowerCase().includes(q)) : zones)
      .map(z => ({
        place_id: z.monument_id,
        name: z.name,
        formatted: z.epochLabel ?? '',
        lat: z.lat,
        lng: z.lon,
        place_type: 'heritage_site',
      }));
    return { success: true, data: results };
  } catch (error) {
    return createErrorResult(error);
  }
}
