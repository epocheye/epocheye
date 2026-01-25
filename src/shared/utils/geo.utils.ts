/**
 * Geo Utilities
 * Pure utility functions for geolocation calculations
 */

/**
 * Earth's radius in meters
 */
const EARTH_RADIUS_METERS = 6371e3;

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 *
 * @example
 * const distance = calculateDistance(28.6139, 77.2090, 28.5355, 77.3910);
 * console.log(`Distance: ${distance} meters`);
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Convert to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if a value is a valid coordinate
 * @param value - Value to check
 * @returns true if valid coordinate, false otherwise
 */
export function isValidCoordinate(value: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= 180
  );
}

/**
 * Check if coordinates are valid
 * @param latitude - Latitude value
 * @param longitude - Longitude value
 * @returns true if both coordinates are valid
 */
export function areValidCoordinates(
  latitude: number,
  longitude: number
): boolean {
  return (
    isValidCoordinate(latitude) &&
    isValidCoordinate(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Format distance for display
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "500 m" or "2.5 km")
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return 'Unknown';
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }

  return `${Math.round(km)} km`;
}

/**
 * Check if a point is within a given radius of another point
 * @param centerLat - Center latitude
 * @param centerLon - Center longitude
 * @param pointLat - Point latitude
 * @param pointLon - Point longitude
 * @param radiusMeters - Radius in meters
 * @returns true if point is within radius
 */
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusMeters;
}

/**
 * Calculate the bounding box for a given center point and radius
 * Useful for filtering before doing precise distance calculations
 * @param latitude - Center latitude
 * @param longitude - Center longitude
 * @param radiusMeters - Radius in meters
 * @returns Bounding box coordinates
 */
export function getBoundingBox(
  latitude: number,
  longitude: number,
  radiusMeters: number
): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  // Approximate degrees per meter
  const latDegrees = radiusMeters / 111320;
  const lonDegrees = radiusMeters / (111320 * Math.cos((latitude * Math.PI) / 180));

  return {
    minLat: latitude - latDegrees,
    maxLat: latitude + latDegrees,
    minLon: longitude - lonDegrees,
    maxLon: longitude + lonDegrees,
  };
}
