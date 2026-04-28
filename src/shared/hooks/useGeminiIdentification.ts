/**
 * useGeminiIdentification
 *
 * Shared hook for Gemini-powered heritage identification with offline
 * cache support and premium gating.
 * Extracted from LensScreen so ARExperienceScreen can reuse the same logic.
 */

import { useCallback, useState } from 'react';
import Geolocation from '@react-native-community/geolocation';
import {
  identifyAny,
  identifyHeritage,
  prepareImageForGemini,
  type GeminiIdentification,
} from '../../services/geminiVisionService';
import {
  cacheResult,
  findCachedResult,
} from '../../services/geminiCacheService';
import { trackUsageEvent } from '../../services/usageTelemetryService';
import { useLensPremium } from './useLensPremium';
import { useNetwork } from '../../context';
import type { Camera as VisionCamera } from 'react-native-vision-camera';

export interface UseGeminiIdentificationOptions {
  /** Hint for the monument name (e.g. from matched place) */
  siteHint?: string;
  /** Zone ID for telemetry */
  zoneId?: string;
}

export interface UseGeminiIdentificationReturn {
  result: GeminiIdentification | null;
  loading: boolean;
  error: string | null;
  isOfflineResult: boolean;
  /** Run identification from a camera ref — takes photo and sends to Gemini */
  identify: (cameraRef: React.RefObject<VisionCamera | null>) => Promise<void>;
  /** Clear current identification results */
  dismiss: () => void;
  /** Whether the user can still identify (has remaining calls) */
  canIdentify: boolean;
  /** Remaining free-tier calls today */
  remainingCalls: number;
  /** Whether user has premium mask/details access */
  canShowMask: boolean;
  canShowDetails: boolean;
}

export function useGeminiIdentification(
  options: UseGeminiIdentificationOptions = {},
): UseGeminiIdentificationReturn {
  const { siteHint, zoneId } = options;

  const [result, setResult] = useState<GeminiIdentification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);

  const {
    canIdentify,
    canShowMask,
    canShowDetails,
    canUseOffline,
    remainingCalls,
    checkAndIncrement,
  } = useLensPremium();
  const { isConnected } = useNetwork();

  const identify = useCallback(
    async (cameraRef: React.RefObject<VisionCamera | null>) => {
      if (loading) {
        return;
      }

      const allowed = await checkAndIncrement();
      if (!allowed) {
        setError('Daily identification limit reached — upgrade for unlimited access');
        return;
      }

      setLoading(true);
      setError(null);
      setResult(null);
      setIsOfflineResult(false);

      // Offline path: check cache first
      if (!isConnected) {
        try {
          const pos = await new Promise<{ lat: number; lon: number }>(
            (resolve, reject) => {
              Geolocation.getCurrentPosition(
                p =>
                  resolve({
                    lat: p.coords.latitude,
                    lon: p.coords.longitude,
                  }),
                reject,
                { timeout: 5000, maximumAge: 30000 },
              );
            },
          );
          const cached = await findCachedResult(pos.lat, pos.lon);
          if (cached) {
            setResult(cached.identification);
            setIsOfflineResult(true);
            setLoading(false);
            return;
          }
        } catch {
          // GPS failed while offline
        }
        setError(
          "You're offline — connect to the internet to identify this site",
        );
        setLoading(false);
        return;
      }

      let preparedBase64: string | null = null;
      try {
        const photo = await cameraRef.current?.takePhoto();
        if (!photo) {
          throw new Error('Photo capture failed');
        }

        preparedBase64 = await prepareImageForGemini(photo.path);
        const geminiResult = await identifyHeritage(preparedBase64, siteHint);

        if (geminiResult.success) {
          setResult(geminiResult.data);
          trackUsageEvent('gemini_identify', zoneId);

          // Cache for offline use (premium only)
          if (canUseOffline) {
            Geolocation.getCurrentPosition(
              pos => {
                void cacheResult(
                  geminiResult.data,
                  pos.coords.latitude,
                  pos.coords.longitude,
                  siteHint,
                );
              },
              () => {},
              { timeout: 5000, maximumAge: 30000 },
            );
          }
        } else {
          if (__DEV__) {
            console.warn(
              `[useGeminiIdentification] failure code=${geminiResult.code} error=${geminiResult.error}`,
            );
            // Run the plain-text probe so we can tell whether the API path
            // itself is broken or only the heritage JSON parsing.
            void identifyAny(preparedBase64).then(probe => {
              console.log('[useGeminiIdentification] identifyAny probe:', probe);
            });
          }
          setError(geminiResult.error);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[useGeminiIdentification] unexpected', err);
        }
        setError(
          "Couldn't identify this site — try holding your phone steady and try again",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      loading,
      checkAndIncrement,
      isConnected,
      siteHint,
      zoneId,
      canUseOffline,
    ],
  );

  const dismiss = useCallback(() => {
    setResult(null);
    setError(null);
    setIsOfflineResult(false);
  }, []);

  return {
    result,
    loading,
    error,
    isOfflineResult,
    identify,
    dismiss,
    canIdentify,
    remainingCalls,
    canShowMask,
    canShowDetails,
  };
}
