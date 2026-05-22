import {useMemo} from 'react';

const EARTH_RADIUS_KM = 6371;
// TODO: replace this 40 km/h constant with a routing API or time-of-day model.
const ASSUMED_AVG_SPEED_KMH = 40;

type LatLng = {lat: number; lng: number};

type DistanceResult = {
  distanceKm: number | null;
  etaMinutes: number | null;
};

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      sinDLng *
      sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function useDistanceToSite(
  userLocation: LatLng | null,
  siteCoords: LatLng,
): DistanceResult {
  return useMemo<DistanceResult>(() => {
    if (!userLocation) return {distanceKm: null, etaMinutes: null};
    const distanceKm = haversineKm(userLocation, siteCoords);
    const etaMinutes = Math.round((distanceKm / ASSUMED_AVG_SPEED_KMH) * 60);
    return {distanceKm, etaMinutes};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lng, siteCoords.lat, siteCoords.lng]);
}
