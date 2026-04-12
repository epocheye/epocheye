/**
 * Heritage site geofence zone definitions.
 *
 * These are pilot zones — meant to be replaced by a backend API once
 * the server-side zone management is built. Until then, updating this
 * file and shipping a new build is the only way to add/remove zones.
 */

export interface HeritageZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  /** Display label for the historical era, e.g. "13th Century" */
  epochLabel: string;
}

export const HERITAGE_ZONES: HeritageZone[] = [
  {
    id: 'konark_sun_temple',
    name: 'Konark Sun Temple',
    lat: 19.8876,
    lon: 86.0945,
    radiusMeters: 500,
    epochLabel: '13th Century',
  },
  {
    id: 'lingaraj_temple',
    name: 'Lingaraj Temple',
    lat: 20.2387,
    lon: 85.8342,
    radiusMeters: 400,
    epochLabel: '11th Century',
  },
  {
    id: 'puri_jagannath',
    name: 'Jagannath Temple, Puri',
    lat: 19.8054,
    lon: 85.8315,
    radiusMeters: 500,
    epochLabel: '12th Century',
  },
];
