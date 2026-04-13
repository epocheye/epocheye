/**
 * useMonumentDetection
 *
 * Shared hook that encapsulates GPS-based monument detection with
 * cascading radius search and geofence zone matching.
 * Extracted from LensScreen so ARExperienceScreen can reuse the same logic.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Geolocation from '@react-native-community/geolocation';
import { findPlaces, type Place } from '../../utils/api/places';
import { getActiveZone } from '../../services/geofenceService';
import { fetchZones } from '../../services/zoneService';
import type { HeritageZone } from '../../core/config/geofence.types';

const SEARCH_RADII = [500, 1000, 2000] as const;
const MATCH_TIMEOUT_MS = 8000;

export type DetectionState = 'idle' | 'searching' | 'matched' | 'not_found';

type MatchResult =
  | { kind: 'matched'; place: Place }
  | { kind: 'not_found' }
  | { kind: 'denied' };

async function findNearestPlace(
  latitude: number,
  longitude: number,
): Promise<Place | null> {
  for (const radius of SEARCH_RADII) {
    const result = await findPlaces({
      latitude,
      longitude,
      radius_meters: radius,
      limit: 1,
    });

    if (result.success && result.data.places.length > 0) {
      return result.data.places[0];
    }
  }

  return null;
}

export interface UseMonumentDetectionOptions {
  /** Auto-start detection on mount. Defaults to true. */
  autoStart?: boolean;
}

export interface UseMonumentDetectionReturn {
  state: DetectionState;
  matchedPlace: Place | null;
  activeZone: HeritageZone | null;
  locationDenied: boolean;
  retry: () => Promise<void>;
}

export function useMonumentDetection(
  options: UseMonumentDetectionOptions = {},
): UseMonumentDetectionReturn {
  const { autoStart = true } = options;

  const [state, setState] = useState<DetectionState>('idle');
  const [matchedPlace, setMatchedPlace] = useState<Place | null>(null);
  const [activeZone, setActiveZone] = useState<HeritageZone | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const mountedRef = useRef(true);

  const detectMonument = useCallback(async (): Promise<MatchResult> => {
    return new Promise(resolve => {
      Geolocation.getCurrentPosition(
        async position => {
          try {
            const { latitude, longitude } = position.coords;

            const zone = getActiveZone(latitude, longitude);
            if (mountedRef.current) {
              setActiveZone(zone);
            }

            const place = await findNearestPlace(latitude, longitude);

            if (place) {
              resolve({ kind: 'matched', place });
              return;
            }

            resolve({ kind: 'not_found' });
          } catch {
            resolve({ kind: 'not_found' });
          }
        },
        error => {
          if (error.code === 1) {
            resolve({ kind: 'denied' });
            return;
          }
          resolve({ kind: 'not_found' });
        },
        {
          enableHighAccuracy: true,
          timeout: MATCH_TIMEOUT_MS,
          maximumAge: 0,
        },
      );
    });
  }, []);

  const runDetection = useCallback(async () => {
    setState('searching');
    setMatchedPlace(null);
    setLocationDenied(false);

    const result = await Promise.race<MatchResult | { kind: 'timeout' }>([
      detectMonument(),
      new Promise(resolve => {
        setTimeout(() => resolve({ kind: 'timeout' }), MATCH_TIMEOUT_MS);
      }),
    ]);

    if (!mountedRef.current) {
      return;
    }

    if (result.kind === 'matched') {
      setMatchedPlace(result.place);
      setState('matched');
      return;
    }

    if (result.kind === 'denied') {
      setLocationDenied(true);
    }

    setState('not_found');
  }, [detectMonument]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchZones();

    if (autoStart) {
      runDetection().catch(() => {
        if (mountedRef.current) {
          setState('not_found');
        }
      });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [autoStart, runDetection]);

  return {
    state,
    matchedPlace,
    activeZone,
    locationDenied,
    retry: runDetection,
  };
}
