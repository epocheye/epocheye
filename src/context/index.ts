import React from 'react';
import {
  NetworkProvider,
  useNetwork,
  saveNavigationState,
  getNavigationState,
  clearNavigationState,
  default as NetworkContext,
} from './NetworkContext';
import { usePlacesStore } from '../stores/placesStore';
import { useUserStore } from '../stores/userStore';

export {
  NetworkProvider,
  useNetwork,
  saveNavigationState,
  getNavigationState,
  clearNavigationState,
  NetworkContext,
};

export const UserProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => React.createElement(React.Fragment, null, children);

export const PlacesProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => React.createElement(React.Fragment, null, children);

export function useUser<T>(
  selector: (state: ReturnType<typeof useUserStore.getState>) => T,
): T {
  return useUserStore(selector);
}

export function usePlaces<T>(
  selector: (state: ReturnType<typeof usePlacesStore.getState>) => T,
): T {
  return usePlacesStore(selector);
}
