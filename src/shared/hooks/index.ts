/**
 * Shared Hooks Exports
 * Centralized exports for all shared hooks
 */

export { useDebounce } from './useDebounce';

export { useAsync } from './useAsync';
export type { AsyncState, UseAsyncReturn } from './useAsync';

export { useGeolocation } from './useGeolocation';
export type {
  GeolocationOptions,
  GeolocationState,
  UseGeolocationReturn,
} from './useGeolocation';

export { useMounted } from './useMounted';

export { useResolvedSubjectImage } from './useResolvedSubjectImage';
export type {
  UseResolvedSubjectImageOptions,
  UseResolvedSubjectImageResult,
} from './useResolvedSubjectImage';

export { useTourPurchase } from './useTourPurchase';
export type { PurchaseResult, UseTourPurchaseReturn } from './useTourPurchase';

export { usePremiumPurchase } from './usePremiumPurchase';
export type { UsePremiumPurchaseReturn } from './usePremiumPurchase';

export { usePremiumPass } from './usePremiumPass';
export type { UsePremiumPassReturn } from './usePremiumPass';
