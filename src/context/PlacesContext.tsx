/**
 * Places Context
 * Provides global state management for places, saved places, and smart geo-tracking
 * Implements intelligent caching and location-based API calls
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import Geolocation, { GeoPosition } from '@react-native-community/geolocation';
import {
  findPlaces,
  savePlace,
  unsavePlace,
  getSavedPlaces,
  Place,
  SavedPlace,
} from '../utils/api/places';
import { isAuthenticated } from '../utils/api/auth';

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface PlacesContextType {
  // Nearby places state
  nearbyPlaces: Place[];
  isLoadingNearby: boolean;
  nearbyError: string | null;

  // Saved places state
  savedPlaces: SavedPlace[];
  isLoadingSaved: boolean;
  savedError: string | null;

  // Current location
  currentLocation: LocationData | null;

  // Actions
  refreshNearbyPlaces: () => Promise<void>;
  refreshSavedPlaces: () => Promise<void>;
  toggleSavePlace: (placeId: string, placeData?: Place) => Promise<boolean>;
  isPlaceSaved: (placeId: string) => boolean;

  // Utilities
  clearPlacesData: () => void;
  // Notify the context when auth state changes so it can start/stop tracking
  // without polling AsyncStorage on a 2-second interval.
  setAuthenticated: (authenticated: boolean) => void;
}

const PlacesContext = createContext<PlacesContextType>({
  nearbyPlaces: [],
  isLoadingNearby: false,
  nearbyError: null,
  savedPlaces: [],
  isLoadingSaved: false,
  savedError: null,
  currentLocation: null,
  refreshNearbyPlaces: async () => {},
  refreshSavedPlaces: async () => {},
  toggleSavePlace: async () => false,
  isPlaceSaved: () => false,
  clearPlacesData: () => {},
  setAuthenticated: () => {},
});

interface PlacesProviderProps {
  children: ReactNode;
}

const SEARCH_RADIUS_METERS = 1000;
const SEARCH_RADIUS_FALLBACKS = [1000, 5000, 10000, 20000]; // 1km, 5km, 10km, 20km
const SEARCH_LIMIT = 50;
const API_CALL_COOLDOWN_MS = 60000; // 1 minute
const LOCATION_CHECK_INTERVAL_MS = 5000; // 5 seconds

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function isValidCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= 180;
}

/**
 * Places Provider Component
 * Manages nearby and saved places with intelligent geo-tracking
 */
export const PlacesProvider: React.FC<PlacesProviderProps> = ({ children }) => {
  // State
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState<boolean>(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(
    null,
  );

  // Track authentication state to trigger re-initialization
  const [isUserAuthenticated, setIsUserAuthenticated] =
    useState<boolean>(false);

  // Refs for tracking
  const lastApiCallLocation = useRef<LocationData | null>(null);
  const lastApiCallTime = useRef<number>(0);
  const locationWatchId = useRef<number | null>(null);
  const locationCheckInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  /**
   * Check if user has moved outside the original search radius
   */
  const hasMovedOutsideRadius = useCallback(
    (newLocation: LocationData): boolean => {
      if (!lastApiCallLocation.current) return true;

      const distance = calculateDistance(
        lastApiCallLocation.current.latitude,
        lastApiCallLocation.current.longitude,
        newLocation.latitude,
        newLocation.longitude,
      );

      return distance > SEARCH_RADIUS_METERS;
    },
    [],
  );

  /**
   * Check if enough time has passed since last API call
   */
  const canMakeApiCall = useCallback((): boolean => {
    const now = Date.now();
    return now - lastApiCallTime.current >= API_CALL_COOLDOWN_MS;
  }, []);

  /**
   * Fetch nearby places from API with cascading radius fallback
   * Tries 1km -> 5km -> 10km -> 20km in sequence
   * Only retries after cooldown period (1 minute)
   */
  const fetchNearbyPlaces = useCallback(
    async (location: LocationData, force: boolean = false) => {
      // Check if we should make the API call
      if (!force && !canMakeApiCall()) {
        return;
      }

      if (!force && !hasMovedOutsideRadius(location)) {
        return;
      }

      try {
        setIsLoadingNearby(true);
        setNearbyError(null);

        const authenticated = await isAuthenticated();
        if (!authenticated) {
          setNearbyPlaces([]);
          return;
        }

        // Try each radius in sequence until we find places
        let foundPlaces: Place[] = [];
        let usedRadius = SEARCH_RADIUS_FALLBACKS[0];

        for (let i = 0; i < SEARCH_RADIUS_FALLBACKS.length; i++) {
          const radius = SEARCH_RADIUS_FALLBACKS[i];

          const requestPayload = {
            latitude: location.latitude,
            longitude: location.longitude,
            radius_meters: radius,
            limit: SEARCH_LIMIT,
          };

          const result = await findPlaces(requestPayload);

          if (result.success) {
            const placesArray = result.data?.places || [];
            if (placesArray.length > 0) {
              foundPlaces = placesArray;
              usedRadius = radius;
              break;
            }
          }
        }

        // Update state and tracking after all attempts
        if (foundPlaces.length > 0) {
          const placesWithDistance = foundPlaces.map(place => {
            if (place.distance_meters > 0) {
              return place;
            }

            if (
              !isValidCoordinate(place.lat) ||
              !isValidCoordinate(place.lon) ||
              !isValidCoordinate(location.latitude) ||
              !isValidCoordinate(location.longitude)
            ) {
              return place;
            }

            const distanceMeters = Math.round(
              calculateDistance(
                location.latitude,
                location.longitude,
                place.lat,
                place.lon,
              ),
            );

            return {
              ...place,
              distance_meters: distanceMeters,
            };
          });

          setNearbyPlaces(placesWithDistance);
          lastApiCallLocation.current = location;
          lastApiCallTime.current = Date.now();
        } else {
          setNearbyPlaces([]);
          lastApiCallLocation.current = location;
          lastApiCallTime.current = Date.now();
          setNearbyError('No places found within 20km radius');
        }
      } catch {
        setNearbyError('Failed to fetch nearby places');
      } finally {
        setIsLoadingNearby(false);
      }
    },
    [canMakeApiCall, hasMovedOutsideRadius],
  );

  /**
   * Fetch saved places from API
   */
  const fetchSavedPlaces = useCallback(async () => {
    try {
      setIsLoadingSaved(true);
      setSavedError(null);

      const authenticated = await isAuthenticated();
      if (!authenticated) {
        setSavedPlaces([]);
        return;
      }

      const result = await getSavedPlaces();

      if (result.success) {
        setSavedPlaces(Array.isArray(result.data) ? result.data : []);
      } else {
        setSavedPlaces([]);
        setSavedError(result.error.message);
      }
    } catch {
      setSavedPlaces([]);
      setSavedError('Failed to fetch saved places');
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  /**
   * Handle location updates
   */
  const handleLocationUpdate = useCallback(
    (position: GeoPosition) => {
      const newLocation: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: position.timestamp,
      };

      setCurrentLocation(newLocation);

      // Check if we should fetch new places
      if (hasMovedOutsideRadius(newLocation) && canMakeApiCall()) {
        fetchNearbyPlaces(newLocation);
      }
    },
    [hasMovedOutsideRadius, canMakeApiCall, fetchNearbyPlaces],
  );

  /**
   * Start location tracking
   */
  const startLocationTracking = useCallback(() => {
    // Get initial location
    Geolocation.getCurrentPosition(
      position => {
        handleLocationUpdate(position);
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
        };
        fetchNearbyPlaces(location, true);
      },
      () => {
        setNearbyError('Unable to get your location');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 },
    );

    // Set up periodic location checks
    locationCheckInterval.current = setInterval(() => {
      Geolocation.getCurrentPosition(handleLocationUpdate, () => {}, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5000,
      });
    }, LOCATION_CHECK_INTERVAL_MS);
  }, [handleLocationUpdate, fetchNearbyPlaces]);

  /**
   * Stop location tracking
   */
  const stopLocationTracking = useCallback(() => {
    if (locationWatchId.current !== null) {
      Geolocation.clearWatch(locationWatchId.current);
      locationWatchId.current = null;
    }

    if (locationCheckInterval.current) {
      clearInterval(locationCheckInterval.current);
      locationCheckInterval.current = null;
    }
  }, []);

  /**
   * Toggle save/unsave a place
   */
  const toggleSavePlace = useCallback(
    async (placeId: string, placeData?: Place): Promise<boolean> => {
      if (!Array.isArray(savedPlaces)) {
        return false;
      }

      const isSaved = savedPlaces.some(saved => saved.place_id === placeId);

      try {
        const result = isSaved
          ? await unsavePlace(placeId)
          : await savePlace(
              placeId,
              placeData || nearbyPlaces.find(p => p.id === placeId),
            );

        if (result.success) {
          await fetchSavedPlaces();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [savedPlaces, nearbyPlaces, fetchSavedPlaces],
  );

  /**
   * Check if a place is saved
   */
  const isPlaceSaved = useCallback(
    (placeId: string): boolean => {
      if (!Array.isArray(savedPlaces)) {
        return false;
      }
      return savedPlaces.some(saved => saved.place_id === placeId);
    },
    [savedPlaces],
  );

  /**
   * Public refresh functions
   */
  const refreshNearbyPlaces = useCallback(async () => {
    if (currentLocation) {
      await fetchNearbyPlaces(currentLocation, true);
    }
  }, [currentLocation, fetchNearbyPlaces]);

  const refreshSavedPlaces = useCallback(async () => {
    await fetchSavedPlaces();
  }, [fetchSavedPlaces]);

  /**
   * Clear all places data
   */
  const clearPlacesData = useCallback(() => {
    setNearbyPlaces([]);
    setSavedPlaces([]);
    setCurrentLocation(null);
    lastApiCallLocation.current = null;
    lastApiCallTime.current = 0;
  }, []);

  /**
   * Check authentication status once on mount.
   * Ongoing auth changes are signalled externally via setAuthenticated(),
   * which the navigation root calls after login/logout — no polling needed.
   */
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      setIsUserAuthenticated(authenticated);
    };

    checkAuth();
  }, []);

  /**
   * Initialize location tracking when authentication state changes
   */
  useEffect(() => {
    if (isUserAuthenticated) {
      startLocationTracking();
      fetchSavedPlaces();
    } else {
      stopLocationTracking();
      setNearbyPlaces([]);
      setSavedPlaces([]);
    }

    return () => {
      stopLocationTracking();
    };
  }, [
    isUserAuthenticated,
    startLocationTracking,
    stopLocationTracking,
    fetchSavedPlaces,
  ]);

  const value: PlacesContextType = {
    nearbyPlaces,
    isLoadingNearby,
    nearbyError,
    savedPlaces,
    isLoadingSaved,
    savedError,
    currentLocation,
    refreshNearbyPlaces,
    refreshSavedPlaces,
    toggleSavePlace,
    isPlaceSaved,
    clearPlacesData,
    // Called by the navigation root after login/logout to avoid polling
    setAuthenticated: setIsUserAuthenticated,
  };

  return (
    <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>
  );
};

/**
 * Hook to use Places context
 */
export const usePlaces = (): PlacesContextType => {
  const context = useContext(PlacesContext);
  if (!context) {
    throw new Error('usePlaces must be used within a PlacesProvider');
  }
  return context;
};
