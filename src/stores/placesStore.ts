import Geolocation, {
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import { create } from 'zustand';
import {
  findPlaces,
  getSavedPlaces,
  savePlace,
  unsavePlace,
  type Place,
  type SavedPlace,
} from '../utils/api/places';
import { useSessionStore } from './sessionStore';
import { PermissionService } from '../shared/services/permission.service';

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface PlacesStoreState {
  nearbyPlaces: Place[];
  isLoadingNearby: boolean;
  nearbyError: string | null;
  savedPlaces: SavedPlace[];
  isLoadingSaved: boolean;
  savedError: string | null;
  currentLocation: LocationData | null;
  isTrackingLocation: boolean;
  ensureLocationTracking: () => Promise<void>;
  stopLocationTracking: () => void;
  refreshNearbyPlaces: () => Promise<void>;
  refreshSavedPlaces: () => Promise<void>;
  ensureSavedPlacesLoaded: () => Promise<void>;
  toggleSavePlace: (placeId: string, placeData?: Place) => Promise<boolean>;
  isPlaceSaved: (placeId: string) => boolean;
  clearPlacesData: () => void;
}

const SEARCH_RADIUS_METERS = 1000;
const SEARCH_RADIUS_FALLBACKS = [1000, 5000, 10000, 20000];
const SEARCH_LIMIT = 50;
const API_CALL_COOLDOWN_MS = 60000;

let locationWatchId: number | null = null;
let lastApiCallLocation: LocationData | null = null;
let lastApiCallTime = 0;

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radius = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function isValidCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= 180;
}

function hasMovedOutsideRadius(newLocation: LocationData): boolean {
  if (!lastApiCallLocation) {
    return true;
  }

  const distance = calculateDistance(
    lastApiCallLocation.latitude,
    lastApiCallLocation.longitude,
    newLocation.latitude,
    newLocation.longitude,
  );

  return distance > SEARCH_RADIUS_METERS;
}

function canMakeApiCall(): boolean {
  return Date.now() - lastApiCallTime >= API_CALL_COOLDOWN_MS;
}

async function fetchNearbyPlacesInternal(
  location: LocationData,
  force = false,
): Promise<{
  places: Place[];
  error: string | null;
}> {
  if (!useSessionStore.getState().authenticated) {
    return {
      places: [],
      error: null,
    };
  }

  if (!force && (!canMakeApiCall() || !hasMovedOutsideRadius(location))) {
    return {
      places: usePlacesStore.getState().nearbyPlaces,
      error: usePlacesStore.getState().nearbyError,
    };
  }

  let foundPlaces: Place[] = [];

  for (const radius of SEARCH_RADIUS_FALLBACKS) {
    const result = await findPlaces({
      latitude: location.latitude,
      longitude: location.longitude,
      radius_meters: radius,
      limit: SEARCH_LIMIT,
    });

    if (result.success) {
      const places = result.data?.places ?? [];
      if (places.length > 0) {
        foundPlaces = places;
        break;
      }
    }
  }

  lastApiCallLocation = location;
  lastApiCallTime = Date.now();

  if (foundPlaces.length === 0) {
    return {
      places: [],
      error: 'No places found within 20km radius',
    };
  }

  return {
    places: foundPlaces.map(place => {
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

      return {
        ...place,
        distance_meters: Math.round(
          calculateDistance(
            location.latitude,
            location.longitude,
            place.lat,
            place.lon,
          ),
        ),
      };
    }),
    error: null,
  };
}

function handleLocationUpdate(position: GeolocationResponse): void {
  const newLocation: LocationData = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    timestamp: position.timestamp,
  };

  usePlacesStore.setState({
    currentLocation: newLocation,
  });

  if (hasMovedOutsideRadius(newLocation) && canMakeApiCall()) {
    usePlacesStore.getState().refreshNearbyPlaces().catch(() => undefined);
  }

  // Heritage-site arrival detection — fires a local notification + prefetches
  // the AR catalog when the user crosses into one of the curated zones.
  // Imported lazily to avoid pulling Notifee into the bundle path of a
  // store init when the app is started cold.
  void import('../services/siteDetectionService').then(m =>
    m.checkZoneEntry(newLocation.latitude, newLocation.longitude),
  );
}

export const usePlacesStore = create<PlacesStoreState>((set, get) => ({
  nearbyPlaces: [],
  isLoadingNearby: false,
  nearbyError: null,
  savedPlaces: [],
  isLoadingSaved: false,
  savedError: null,
  currentLocation: null,
  isTrackingLocation: false,
  ensureLocationTracking: async () => {
    if (!useSessionStore.getState().authenticated || get().isTrackingLocation) {
      return;
    }

    // Request runtime permission before touching Geolocation. On Android 6+
    // Geolocation.getCurrentPosition silently fails without this; on iOS the
    // system prompt fires here rather than inside the native module.
    const hasPermission =
      (await PermissionService.check('location')) ||
      (await PermissionService.request('location'));
    if (!hasPermission) {
      set({
        isTrackingLocation: false,
        nearbyError: 'Location permission denied',
      });
      return;
    }

    set({
      isTrackingLocation: true,
      nearbyError: null,
    });

    await new Promise<void>(resolve => {
      Geolocation.getCurrentPosition(
        position => {
          handleLocationUpdate(position);
          get().refreshNearbyPlaces().catch(() => undefined);
          resolve();
        },
        () => {
          set({
            nearbyError: 'Unable to get your location',
          });
          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    });

    locationWatchId = Geolocation.watchPosition(
      position => {
        handleLocationUpdate(position);
      },
      () => undefined,
      {
        enableHighAccuracy: false,
        distanceFilter: 100,
        interval: 30000,
        fastestInterval: 15000,
      },
    );
  },
  stopLocationTracking: () => {
    if (locationWatchId !== null) {
      Geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }

    set({
      isTrackingLocation: false,
    });
  },
  refreshNearbyPlaces: async () => {
    const location = get().currentLocation;
    if (!location) {
      return;
    }

    set({
      isLoadingNearby: true,
      nearbyError: null,
    });

    try {
      const result = await fetchNearbyPlacesInternal(location, true);
      set({
        nearbyPlaces: result.places,
        nearbyError: result.error,
        isLoadingNearby: false,
      });
    } catch {
      set({
        isLoadingNearby: false,
        nearbyError: 'Failed to fetch nearby places',
      });
    }
  },
  refreshSavedPlaces: async () => {
    if (!useSessionStore.getState().authenticated) {
      set({
        savedPlaces: [],
        savedError: null,
      });
      return;
    }

    set({
      isLoadingSaved: true,
      savedError: null,
    });

    try {
      const result = await getSavedPlaces();
      set({
        savedPlaces: result.success
          ? Array.isArray(result.data)
            ? result.data
            : []
          : [],
        savedError: result.success ? null : result.error.message,
        isLoadingSaved: false,
      });
    } catch {
      set({
        savedPlaces: [],
        savedError: 'Failed to fetch saved places',
        isLoadingSaved: false,
      });
    }
  },
  ensureSavedPlacesLoaded: async () => {
    if (get().savedPlaces.length > 0 || get().isLoadingSaved) {
      return;
    }
    await get().refreshSavedPlaces();
  },
  toggleSavePlace: async (placeId, placeData) => {
    const { savedPlaces, nearbyPlaces } = get();
    const isSaved = savedPlaces.some(saved => saved.place_id === placeId);

    try {
      const result = isSaved
        ? await unsavePlace(placeId)
        : await savePlace(
            placeId,
            placeData ?? nearbyPlaces.find(place => place.id === placeId),
          );

      if (!result.success) {
        return false;
      }

      await get().refreshSavedPlaces();
      return true;
    } catch {
      return false;
    }
  },
  isPlaceSaved: placeId => {
    return get().savedPlaces.some(saved => saved.place_id === placeId);
  },
  clearPlacesData: () => {
    if (locationWatchId !== null) {
      Geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }

    lastApiCallLocation = null;
    lastApiCallTime = 0;

    set({
      nearbyPlaces: [],
      isLoadingNearby: false,
      nearbyError: null,
      savedPlaces: [],
      isLoadingSaved: false,
      savedError: null,
      currentLocation: null,
      isTrackingLocation: false,
    });
  },
}));
