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
import { ipLocate } from '../utils/api/geo/Geo';

// Use Google Play Services' fused location provider when available. Without this,
// @react-native-community/geolocation defaults to Android's legacy
// `android.location` provider, which often never returns a fix on WiFi-only
// tablets / emulators (no GPS) — leaving the whole Home experience stuck on the
// all-India default. 'auto' falls back to android.location where Play Services
// isn't present. Guarded so a platform without the native config can't crash init.
try {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
    locationProvider: 'auto',
  });
} catch {
  // no-op — keep the default provider
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  /** Reported horizontal accuracy in meters (when the device provides it). */
  accuracy?: number;
}

// First-fix convergence: a single low-accuracy fix can land far outside a venue,
// so we briefly prefer a better one — but never hang waiting for it.
const GOOD_ACCURACY_M = 30; // good enough to commit immediately
const MAX_CONVERGE_MS = 8000; // hard cap on the wait

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

// getCurrentPosition wrapped as a promise that resolves null (never rejects) on
// timeout/error, so the caller can try a sequence of strategies cleanly.
function getCurrentPositionOnce(
  options: Parameters<typeof Geolocation.getCurrentPosition>[2],
): Promise<GeolocationResponse | null> {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      pos => resolve(pos),
      () => resolve(null),
      options,
    );
  });
}

// Acquire the first authoritative fix without committing to a bad one. Samples
// high-accuracy fixes via a short-lived watch, keeps the best-accuracy fix seen,
// exits early once a fix is "good enough", and always resolves by MAX_CONVERGE_MS
// (returns the best so far, or null if none arrived) so it can never hang.
function acquireConvergedFix(): Promise<GeolocationResponse | null> {
  return new Promise(resolve => {
    let best: GeolocationResponse | null = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      Geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve(best);
    };
    const watchId = Geolocation.watchPosition(
      pos => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
        }
        if (best.coords.accuracy <= GOOD_ACCURACY_M) finish();
      },
      () => finish(),
      { enableHighAccuracy: true, distanceFilter: 0, interval: 1000, fastestInterval: 500 },
    );
    const timer = setTimeout(finish, MAX_CONVERGE_MS);
  });
}

function applyLocation(
  latitude: number,
  longitude: number,
  timestamp: number,
  accuracy?: number,
): void {
  const newLocation: LocationData = { latitude, longitude, timestamp, accuracy };

  usePlacesStore.setState({
    currentLocation: newLocation,
  });

  if (hasMovedOutsideRadius(newLocation) && canMakeApiCall()) {
    usePlacesStore.getState().refreshNearbyPlaces().catch(() => undefined);
  }

  // Heritage-site arrival detection — fires a local notification + prefetches
  // the AR catalog when the user crosses into one of the curated zones.
  // Imported lazily to avoid pulling Notifee into the bundle path of a
  // store init when the app is started cold. Pass accuracy so the zone check
  // can tolerate normal GPS drift instead of locking visitors out.
  void import('../services/siteDetectionService').then(m =>
    m.checkZoneEntry(latitude, longitude, accuracy),
  );
}

function handleLocationUpdate(position: GeolocationResponse): void {
  applyLocation(
    position.coords.latitude,
    position.coords.longitude,
    position.timestamp,
    position.coords.accuracy,
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

    // Acquire the first fix robustly across device types:
    //  1. A cached/last-known fix (accepts up to 10 min old) paints instantly.
    //  2. A fresh network/fused fix refines it.
    //  3. If that fails, one GPS-only retry (some devices only return via GPS).
    // Each strategy resolves null on failure rather than throwing.
    const cached = await getCurrentPositionOnce({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 600000,
    });
    if (cached) {
      handleLocationUpdate(cached);
      get().refreshNearbyPlaces().catch(() => undefined);
    }

    // Prefer a well-converged high-accuracy fix over the first one that arrives;
    // a single low-accuracy fix is exactly what reads "outside" at a venue.
    let fresh = await acquireConvergedFix();
    if (!fresh) {
      // Last resort: one bounded high-accuracy single-shot.
      fresh = await getCurrentPositionOnce({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    }
    if (fresh) {
      handleLocationUpdate(fresh);
      get().refreshNearbyPlaces().catch(() => undefined);
    } else if (!cached) {
      // No device fix at all (e.g. a GPS-less tablet). Fall back to a coarse
      // IP→country location so the map, title, and nearest still resolve to
      // something sensible. A later watchPosition fix overrides it.
      const ip = await ipLocate();
      if (ip) {
        applyLocation(ip.lat, ip.lon, Date.now());
      } else {
        set({ nearbyError: 'Unable to get your location' });
      }
    }

    locationWatchId = Geolocation.watchPosition(
      position => {
        handleLocationUpdate(position);
      },
      () => undefined,
      {
        enableHighAccuracy: true,
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
