/**
 * useGeolocation Hook
 * Manage geolocation state and updates
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Geolocation, {
  type GeolocationError,
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import { LocationData } from '../../core/types';
import { APP_CONFIG } from '../../core/config';
import { ERROR_MESSAGES } from '../../core/constants';

/**
 * Geolocation options
 */
export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Geolocation state
 */
export interface GeolocationState {
  location: LocationData | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Full return type of useGeolocation hook
 */
export interface UseGeolocationReturn extends GeolocationState {
  /** Get current location once */
  getCurrentLocation: () => Promise<LocationData | null>;
  /** Start continuous location watching */
  startWatching: () => void;
  /** Stop location watching */
  stopWatching: () => void;
  /** Whether currently watching location */
  isWatching: boolean;
}

const DEFAULT_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: false,
  timeout: APP_CONFIG.LOCATION.GEOLOCATION_TIMEOUT_MS,
  maximumAge: APP_CONFIG.LOCATION.LOCATION_MAX_AGE_MS,
};

/**
 * Hook for managing geolocation state and updates
 *
 * @param options - Geolocation options
 *
 * @example
 * const { location, isLoading, error, getCurrentLocation } = useGeolocation();
 *
 * useEffect(() => {
 *   getCurrentLocation();
 * }, []);
 */
export function useGeolocation(
  options: GeolocationOptions = {}
): UseGeolocationReturn {
  const { enableHighAccuracy, maximumAge, timeout } = options;
  const mergedOptions = useMemo(
    () => ({
      ...DEFAULT_OPTIONS,
      enableHighAccuracy,
      maximumAge,
      timeout,
    }),
    [enableHighAccuracy, maximumAge, timeout]
  );

  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    isLoading: false,
  });

  const [isWatching, setIsWatching] = useState<boolean>(false);
  const watchId = useRef<number | null>(null);

  /**
   * Handle successful location update
   */
  const handleSuccess = useCallback(
    (position: GeolocationResponse) => {
      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: position.timestamp,
      };

      setState({
        location: locationData,
        error: null,
        isLoading: false,
      });
    },
    []
  );

  /**
   * Handle location error
   */
  const handleError = useCallback(
    (error: GeolocationError) => {
      let errorMessage: string;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = ERROR_MESSAGES.LOCATION.PERMISSION_DENIED;
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = ERROR_MESSAGES.LOCATION.UNAVAILABLE;
          break;
        case error.TIMEOUT:
          errorMessage = ERROR_MESSAGES.LOCATION.TIMEOUT;
          break;
        default:
          errorMessage = ERROR_MESSAGES.LOCATION.UNAVAILABLE;
      }

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
    },
    []
  );

  /**
   * Get current location once
   */
  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          handleSuccess(position);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          handleError(error);
          resolve(null);
        },
        mergedOptions
      );
    });
  }, [handleSuccess, handleError, mergedOptions]);

  /**
   * Start continuous location watching
   */
  const startWatching = useCallback(() => {
    if (watchId.current !== null) {
      return; // Already watching
    }

    setIsWatching(true);
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    watchId.current = Geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        ...mergedOptions,
        distanceFilter: 10, // Update every 10 meters
      }
    );
  }, [handleSuccess, handleError, mergedOptions]);

  /**
   * Stop location watching
   */
  const stopWatching = useCallback(() => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsWatching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return {
    ...state,
    getCurrentLocation,
    startWatching,
    stopWatching,
    isWatching,
  };
}
