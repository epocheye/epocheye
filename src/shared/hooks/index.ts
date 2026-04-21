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

export { usePremiumPurchase } from './usePremiumPurchase';
export type { UsePremiumPurchaseReturn } from './usePremiumPurchase';

export { usePremiumPass } from './usePremiumPass';
export type { UsePremiumPassReturn } from './usePremiumPass';

export { useLensPremium } from './useLensPremium';
export type { UseLensPremiumReturn } from './useLensPremium';

export { useExplorerPass } from './useExplorerPass';
export type { UseExplorerPassReturn } from './useExplorerPass';

export { useExplorerPassPurchase } from './useExplorerPassPurchase';
export type { UseExplorerPassPurchaseReturn } from './useExplorerPassPurchase';

export { useMonumentDetection } from './useMonumentDetection';
export type {
  DetectionState,
  UseMonumentDetectionOptions,
  UseMonumentDetectionReturn,
} from './useMonumentDetection';

export { useGeminiIdentification } from './useGeminiIdentification';
export type {
  UseGeminiIdentificationOptions,
  UseGeminiIdentificationReturn,
} from './useGeminiIdentification';
