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
import Geolocation from '@react-native-community/geolocation';
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
  toggleSavePlace: (placeId: string) => Promise<boolean>;
  isPlaceSaved: (placeId: string) => boolean;

  // Utilities
  clearPlacesData: () => void;
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
});

interface PlacesProviderProps {
  children: ReactNode;
}

const SEARCH_RADIUS_METERS = 1000;
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
   * Fetch nearby places from API
   */
  const fetchNearbyPlaces = useCallback(
    async (location: LocationData, force: boolean = false) => {
      // Check if we should make the API call
      if (!force && !canMakeApiCall()) {
        console.log('API call cooldown active, skipping...');
        return;
      }

      if (!force && !hasMovedOutsideRadius(location)) {
        console.log('User still within radius, skipping API call...');
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

        const result = await findPlaces({
          latitude: location.latitude,
          longitude: location.longitude,
          radius_meters: SEARCH_RADIUS_METERS,
          limit: SEARCH_LIMIT,
        });

        if (result.success) {
          setNearbyPlaces(result.data.places);
          lastApiCallLocation.current = location;
          lastApiCallTime.current = Date.now();
          console.log(`Fetched ${result.data.places.length} nearby places`);
        } else {
          setNearbyError(result.error.message);
          console.error('Failed to fetch nearby places:', result.error.message);
        }
      } catch (error) {
        setNearbyError('Failed to fetch nearby places');
        console.error('Error fetching nearby places:', error);
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
        setSavedPlaces(result.data);
        console.log(`Fetched ${result.data.length} saved places`);
      } else {
        setSavedError(result.error.message);
        console.error('Failed to fetch saved places:', result.error.message);
      }
    } catch (error) {
      setSavedError('Failed to fetch saved places');
      console.error('Error fetching saved places:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  /**
   * Handle location updates
   */
  const handleLocationUpdate = useCallback(
    (position: any) => {
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
        // Fetch places immediately on first load
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
        };
        fetchNearbyPlaces(location, true);
      },
      error => {
        console.error('Error getting initial location:', error);
        setNearbyError('Unable to get your location');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 },
    );

    // Set up periodic location checks every 5 seconds
    locationCheckInterval.current = setInterval(() => {
      Geolocation.getCurrentPosition(
        handleLocationUpdate,
        error => {
          console.warn('Error updating location:', error);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5000 },
      );
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
    async (placeId: string): Promise<boolean> => {
      const isSaved = savedPlaces.some(saved => saved.place_id === placeId);

      try {
        let result;
        if (isSaved) {
          result = await unsavePlace(placeId);
        } else {
          result = await savePlace(placeId);
        }

        if (result.success) {
          // Refresh saved places
          await fetchSavedPlaces();
          return true;
        } else {
          console.error(
            `Failed to ${isSaved ? 'unsave' : 'save'} place:`,
            result.error.message,
          );
          return false;
        }
      } catch (error) {
        console.error('Error toggling save place:', error);
        return false;
      }
    },
    [savedPlaces, fetchSavedPlaces],
  );

  /**
   * Check if a place is saved
   */
  const isPlaceSaved = useCallback(
    (placeId: string): boolean => {
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
   * Initialize on mount
   */
  useEffect(() => {
    const initialize = async () => {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        startLocationTracking();
        fetchSavedPlaces();
      }
    };

    initialize();

    return () => {
      stopLocationTracking();
    };
  }, [startLocationTracking, stopLocationTracking, fetchSavedPlaces]);

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
