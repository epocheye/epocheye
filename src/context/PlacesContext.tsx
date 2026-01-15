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
      console.log('========== FINDPLACES DEBUG START ==========');
      console.log('Location:', {
        lat: location.latitude,
        lon: location.longitude,
        timestamp: new Date(location.timestamp).toISOString(),
      });
      console.log('Force fetch:', force);

      // Check if we should make the API call
      if (!force && !canMakeApiCall()) {
        const timeSinceLastCall = Date.now() - lastApiCallTime.current;
        const remainingTime = Math.ceil(
          (API_CALL_COOLDOWN_MS - timeSinceLastCall) / 1000,
        );
        console.log(
          `⏳ API call cooldown active. Wait ${remainingTime}s more.`,
        );
        console.log('========== FINDPLACES DEBUG END ==========');
        return;
      }

      if (!force && !hasMovedOutsideRadius(location)) {
        console.log('📍 User still within 1km radius, skipping API call');
        if (lastApiCallLocation.current) {
          const distance = calculateDistance(
            lastApiCallLocation.current.latitude,
            lastApiCallLocation.current.longitude,
            location.latitude,
            location.longitude,
          );
          console.log(
            `Current distance from last check: ${distance.toFixed(0)}m`,
          );
        }
        console.log('========== FINDPLACES DEBUG END ==========');
        return;
      }

      try {
        setIsLoadingNearby(true);
        setNearbyError(null);
        console.log('🔍 Starting cascading radius search...');

        const authenticated = await isAuthenticated();
        if (!authenticated) {
          console.log('❌ User not authenticated');
          setNearbyPlaces([]);
          console.log('========== FINDPLACES DEBUG END ==========');
          return;
        }
        console.log('✅ User authenticated');

        // Try each radius in sequence until we find places
        let foundPlaces: Place[] = [];
        let usedRadius = SEARCH_RADIUS_FALLBACKS[0];

        for (let i = 0; i < SEARCH_RADIUS_FALLBACKS.length; i++) {
          const radius = SEARCH_RADIUS_FALLBACKS[i];
          console.log(
            `\n🔎 Attempt ${i + 1}/${
              SEARCH_RADIUS_FALLBACKS.length
            }: Searching within ${radius}m (${radius / 1000}km)...`,
          );

          const requestPayload = {
            latitude: location.latitude,
            longitude: location.longitude,
            radius_meters: radius,
            limit: SEARCH_LIMIT,
          };
          console.log('📤 API Request:', JSON.stringify(requestPayload));

          const startTime = Date.now();
          const result = await findPlaces(requestPayload);
          const duration = Date.now() - startTime;

          console.log(`⏱️  API Response time: ${duration}ms`);

          if (result.success) {
            const placesArray = result.data?.places || [];
            console.log(`✅ API Success: ${placesArray.length} places found`);
            if (placesArray.length > 0) {
              foundPlaces = placesArray;
              usedRadius = radius;
              console.log(
                `🎯 Success at ${radius}m! Found ${foundPlaces.length} places`,
              );
              console.log(
                'Sample places:',
                foundPlaces.slice(0, 3).map(p => ({
                  id: p.id,
                  name: p.name,
                  distance: `${p.distance_meters}m`,
                })),
              );
              break;
            } else {
              console.log(
                `⚠️  No places at ${radius}m, trying larger radius...`,
              );
            }
          } else {
            console.error(`❌ API Error at ${radius}m:`, {
              message: result.error.message,
              statusCode: result.error.statusCode,
            });
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
          console.log(
            `\n✅ FINAL RESULT: ${
              foundPlaces.length
            } places (radius: ${usedRadius}m / ${usedRadius / 1000}km)`,
          );
          console.log(
            `Next API call allowed at: ${new Date(
              Date.now() + API_CALL_COOLDOWN_MS,
            ).toLocaleTimeString()}`,
          );
        } else {
          setNearbyPlaces([]);
          lastApiCallLocation.current = location;
          lastApiCallTime.current = Date.now();
          setNearbyError('No places found within 20km radius');
          console.log(
            '\n❌ FINAL RESULT: No places found at any radius (1km -> 5km -> 10km -> 20km)',
          );
          console.log('Will retry after cooldown period (1 minute)');
        }
      } catch (error) {
        setNearbyError('Failed to fetch nearby places');
        console.error('💥 CRITICAL ERROR:', error);
      } finally {
        setIsLoadingNearby(false);
        console.log('========== FINDPLACES DEBUG END ==========\n');
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
   * Check authentication status periodically
   * This ensures we start tracking when user logs in
   */
  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      setIsUserAuthenticated(authenticated);
    };

    // Check immediately
    checkAuth();

    // Check periodically (every 2 seconds) to detect login/logout
    const authCheckInterval = setInterval(checkAuth, 2000);

    return () => {
      clearInterval(authCheckInterval);
    };
  }, []);

  /**
   * Initialize location tracking when authentication state changes
   */
  useEffect(() => {
    if (isUserAuthenticated) {
      console.log('🔐 User authenticated, starting location tracking...');
      startLocationTracking();
      fetchSavedPlaces();
    } else {
      console.log('🔓 User not authenticated, stopping location tracking...');
      stopLocationTracking();
      // Clear places data when logged out
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
