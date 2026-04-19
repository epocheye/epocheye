import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import Geolocation from '@react-native-community/geolocation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, ScanEye, X } from 'lucide-react-native';
import { track } from '../../services/analytics';
import { findPlaces, type Place } from '../../utils/api/places';
import { getFallbackStory } from '../../services/fallbackStories';
import {
  streamLensStory,
  type LensIdentifiedObject,
} from '../../services/lensStoryService';
import { usePlaces, useUser, useNetwork } from '../../context';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { useLensPremium } from '../../shared/hooks/useLensPremium';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { FONTS } from '../../core/constants/theme';
import { ROUTES } from '../../core/constants';
import {
  identifyHeritage,
  fileToBase64,
  type GeminiIdentification,
} from '../../services/geminiVisionService';
import { getActiveZone } from '../../services/geofenceService';
import type { HeritageZone } from '../../core/config/geofence.types';
import {
  cacheResult,
  findCachedResult,
} from '../../services/geminiCacheService';
import { fetchZones } from '../../services/zoneService';
import { trackUsageEvent } from '../../services/usageTelemetryService';
import { performHDScan, type HDScanMask } from '../../services/hdScanService';
import { getValidAccessToken } from '../../utils/api/auth';
import { logVisit } from '../../utils/api/userActions';
import { useARCore } from '../../shared/hooks/useARCore';
import EpocheyeARView from '../../native/EpocheyeARView';
import { reconstructForLens } from '../../services/arReconstructionService';
import { useArQuotaStore } from '../../stores/arQuotaStore';
import ARQuotaPill from '../../components/ARQuotaPill';
import AncestorStorySheet, {
  type AncestorStorySheetRef,
} from './components/AncestorStorySheet';
import BottomCard, { type LensDetectionState } from './components/BottomCard';
import EpochChips from './components/EpochChips';
import IdentificationCard from './components/IdentificationCard';
import MonumentInfoSheet, {
  type MonumentInfoSheetRef,
} from './components/MonumentInfoSheet';
import PulsingRing from './components/PulsingRing';
import SearchSheet, { type SearchSheetRef } from './components/SearchSheet';
import HDScanOverlay from './components/HDScanOverlay';
import SegmentationOverlay from './components/SegmentationOverlay';
import * as segmentationService from '../../services/segmentationService';

type Props = MainScreenProps<'Lens'>;

type MatchResult =
  | { kind: 'matched'; place: Place }
  | { kind: 'not_found' }
  | { kind: 'denied' };

const SEARCH_RADII = [500, 1000, 2000] as const;
const MATCH_TIMEOUT_MS = 8000;

function normalizePhotoUri(path: string): string {
  if (path.startsWith('file://')) {
    return path;
  }
  return `file://${path}`;
}

async function findNearestPlace(
  latitude: number,
  longitude: number,
): Promise<Place | null> {
  for (const radius of SEARCH_RADII) {
    const result = await findPlaces({
      latitude,
      longitude,
      radius_meters: radius,
      limit: 1,
    });

    if (result.success && result.data.places.length > 0) {
      return result.data.places[0];
    }
  }

  return null;
}

const LensScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const profile = useUser(state => state.profile);
  const nearbyPlaces = usePlaces(state => state.nearbyPlaces);
  const ensureLocationTracking = usePlaces(
    state => state.ensureLocationTracking,
  );
  const storeFirstName = useOnboardingStore(state => state.firstName);
  const storeMotivation = useOnboardingStore(state => state.motivation);
  const storeRegions = useOnboardingStore(state => state.regions);

  const { hasPermission, requestPermission } = useCameraPermission();
  const permissionRequestedRef = useRef(false);

  const cameraRef = useRef<VisionCamera | null>(null);
  const storySheetRef = useRef<AncestorStorySheetRef | null>(null);
  const infoSheetRef = useRef<MonumentInfoSheetRef | null>(null);
  const searchSheetRef = useRef<SearchSheetRef | null>(null);
  const storyAbortRef = useRef<(() => void) | null>(null);
  const notFoundTrackedRef = useRef(false);

  const device = useCameraDevice('back');

  const [state, setState] = useState<LensDetectionState>('searching');
  const [matchedPlace, setMatchedPlace] = useState<Place | null>(null);
  const [lastKnownCoords, setLastKnownCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationContext, setLocationContext] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [showRing, setShowRing] = useState(true);
  const [ringMatched, setRingMatched] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyStreaming, setStoryStreaming] = useState(false);
  const [storyMode, setStoryMode] = useState<'monument' | 'object_scan'>(
    'monument',
  );
  const [identifiedObject, setIdentifiedObject] =
    useState<LensIdentifiedObject | null>(null);

  // Reconstruction state for the "View in 3D" CTA shown after object_scan.
  const [reconstructionReady, setReconstructionReady] = useState<null | {
    glbUrl: string;
    thumbnailUrl?: string;
    provider: string;
    cached: boolean;
    objectLabel: string;
    quality?: string;
    scanCount?: number;
  }>(null);
  const [reconstructionLoading, setReconstructionLoading] = useState(false);
  const [reconstructionQuotaExceeded, setReconstructionQuotaExceeded] =
    useState(false);
  const [reconstructionGateError, setReconstructionGateError] = useState<
    string | null
  >(null);
  const lastCapturedImageRef = useRef<string | null>(null);

  const arEnabled = useArQuotaStore(state => state.enabled && !state.maintenanceMode);

  // ── Gemini identification state ──
  const [geminiResult, setGeminiResult] = useState<GeminiIdentification | null>(
    null,
  );
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<HeritageZone | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);

  // Premium + network state
  const {
    canIdentify,
    canShowMask,
    canShowDetails,
    canUseOffline,
    remainingCalls,
    checkAndIncrement,
  } = useLensPremium();
  const { isConnected } = useNetwork();
  const { arAvailable } = useARCore();

  // HD Scan state (SAM Lambda)
  const [hdMasks, setHdMasks] = useState<HDScanMask[]>([]);
  const [hdScanLoading, setHdScanLoading] = useState(false);

  // Live-segmentation state for the Scan Object mode. React state
  // drives UI conditionals; the shared values are read by the
  // frame-processor worklet (which cannot see React state directly).
  const [isScanModeActive, setIsScanModeActive] = useState(false);
  const [segReady, setSegReady] = useState(false);
  const isScanModeActiveShared = useSharedValue(false);
  const isInferenceRunning = useSharedValue(false);
  const maskShared = useSharedValue<Float32Array | null>(null);
  const frameCount = useSharedValue(0);
  const { resize } = useResizePlugin();
  const { width: screenWidth, height: screenHeight } = useMemo(
    () => Dimensions.get('window'),
    [],
  );

  const firstName = useMemo(() => {
    const fromProfile = profile?.name?.trim();
    if (fromProfile && fromProfile.length > 0) {
      return fromProfile;
    }

    const fromStore = storeFirstName.trim();
    return fromStore.length > 0 ? fromStore : 'Explorer';
  }, [profile?.name, storeFirstName]);

  const regions = useMemo(
    () => (storeRegions.length > 0 ? storeRegions : ['South Asia']),
    [storeRegions],
  );

  const motivation = useMemo(
    () => storeMotivation ?? 'heritage_visitor',
    [storeMotivation],
  );

  const transitionToNotFound = useCallback((isLocationDenied: boolean) => {
    setState('not_found');
    setMatchedPlace(null);
    setLocationDenied(isLocationDenied);
    setShowRing(false);
    setRingMatched(false);

    if (!notFoundTrackedRef.current) {
      notFoundTrackedRef.current = true;
      track('lens_monument_not_found', {
        reason: isLocationDenied ? 'location_denied' : 'no_match',
      });
    }
  }, []);

  const detectMonument = useCallback(async (): Promise<MatchResult> => {
    return new Promise(resolve => {
      Geolocation.getCurrentPosition(
        async position => {
          try {
            const { latitude, longitude } = position.coords;
            setLastKnownCoords({ latitude, longitude });

            // Check geofence zones
            const zone = getActiveZone(latitude, longitude);
            setActiveZone(zone);

            const place = await findNearestPlace(latitude, longitude);

            if (place) {
              resolve({ kind: 'matched', place });
              return;
            }

            resolve({ kind: 'not_found' });
          } catch {
            resolve({ kind: 'not_found' });
          }
        },
        error => {
          if (error.code === 1) {
            resolve({ kind: 'denied' });
            return;
          }
          resolve({ kind: 'not_found' });
        },
        {
          enableHighAccuracy: true,
          timeout: MATCH_TIMEOUT_MS,
          maximumAge: 0,
        },
      );
    });
  }, []);

  const runDetection = useCallback(async () => {
    setState('searching');
    setMatchedPlace(null);
    setLocationDenied(false);
    setShowRing(true);
    setRingMatched(false);
    notFoundTrackedRef.current = false;

    const result = await Promise.race<MatchResult | { kind: 'timeout' }>([
      detectMonument(),
      new Promise(resolve => {
        setTimeout(() => resolve({ kind: 'timeout' }), MATCH_TIMEOUT_MS);
      }),
    ]);

    if (result.kind === 'matched') {
      setMatchedPlace(result.place);
      setState('matched');
      setRingMatched(true);
      track('lens_monument_matched', { value: result.place.name });
      return;
    }

    if (result.kind === 'denied') {
      transitionToNotFound(true);
      return;
    }

    transitionToNotFound(false);
  }, [detectMonument, transitionToNotFound]);

  useEffect(() => {
    track('lens_opened');
  }, []);

  useEffect(() => {
    void ensureLocationTracking();
    void fetchZones(); // Fetch dynamic zones from backend (fire-and-forget)
  }, [ensureLocationTracking]);

  useEffect(() => {
    if (!hasPermission && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestPermission().catch(() => {
        // Permission request errors are handled by the fallback UI below.
      });
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    runDetection().catch(() => {
      transitionToNotFound(false);
    });
  }, [runDetection, transitionToNotFound]);

  useEffect(() => {
    return () => {
      storyAbortRef.current?.();
    };
  }, []);

  // Load the TFLite segmentation model on mount. Fire-and-forget —
  // it must never block render. If the asset is missing or corrupt,
  // initialize() silently logs and leaves ready=false; the frame
  // processor no-ops and the overlay never mounts.
  useEffect(() => {
    void segmentationService.initialize();
    const unsubscribe = segmentationService.subscribeReady(setSegReady);
    return () => {
      unsubscribe();
      segmentationService.dispose();
      maskShared.value = null;
    };
    // maskShared is a stable SharedValue — no dep needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror React state -> shared value so the worklet can gate on it,
  // and clear the mask whenever scan mode is turned off.
  useEffect(() => {
    isScanModeActiveShared.value = isScanModeActive;
    if (!isScanModeActive) {
      maskShared.value = null;
    }
  }, [isScanModeActive, isScanModeActiveShared, maskShared]);

  // Auto-teardown: when the object_scan SSE finishes streaming (or
  // errors), turn scan mode off. This piggybacks on the existing
  // storyStreaming transition so we don't touch the success/error
  // paths inline in handleScanObject.
  useEffect(() => {
    if (!storyStreaming && storyMode === 'object_scan' && isScanModeActive) {
      setIsScanModeActive(false);
    }
  }, [storyStreaming, storyMode, isScanModeActive]);

  // Frame processor: runs on VisionCamera's native worklet thread.
  // Never touches the JS thread. `model.runSync` blocks this thread
  // while inference is in progress; the re-entrance lock ensures
  // subsequent frames are dropped rather than queued, so preview FPS
  // is never affected regardless of inference latency.
  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';

      if (!isScanModeActiveShared.value) {
        return;
      }

      // Skip 2 out of every 3 frames to reduce CPU/GPU load
      frameCount.value += 1;
      if (frameCount.value % 3 !== 0) {
        return;
      }

      const m = segmentationService.getModel();
      if (!m) {
        return;
      }

      if (isInferenceRunning.value) {
        return;
      }
      isInferenceRunning.value = true;

      try {
        const input = resize(frame, {
          scale: { width: 257, height: 257 },
          pixelFormat: 'rgb',
          dataType: 'float32',
        });
        const output = m.runSync([input]);
        const raw = output[0] as unknown as Float32Array;

        // DeepLab v3 output is either:
        //   - [257*257]        argmax class indices (int cast to float)
        //   - [257*257 * 21]   raw logits per class
        // In both cases we produce a binary Float32Array:
        //   0.0 = background (class 0), 1.0 = any foreground class
        const PIXELS = 257 * 257; // 66049
        const numClasses = Math.round(raw.length / PIXELS);
        const binaryMask = new Float32Array(PIXELS);

        if (numClasses <= 1) {
          // Argmax map — non-zero means foreground
          for (let i = 0; i < PIXELS; i++) {
            binaryMask[i] = raw[i] !== 0 ? 1.0 : 0.0;
          }
        } else {
          // Logits — find argmax per pixel; class 0 = background
          for (let i = 0; i < PIXELS; i++) {
            const base = i * numClasses;
            let maxVal = raw[base];
            let maxClass = 0;
            for (let c = 1; c < numClasses; c++) {
              const v = raw[base + c];
              if (v > maxVal) {
                maxVal = v;
                maxClass = c;
              }
            }
            binaryMask[i] = maxClass !== 0 ? 1.0 : 0.0;
          }
        }

        maskShared.value = binaryMask;
      } catch {
        // Per-frame failures are silent — logging here would flood
        // logcat under any steady-state failure mode.
      } finally {
        isInferenceRunning.value = false;
      }
    },
    [isScanModeActiveShared, isInferenceRunning, maskShared, resize],
  );

  const handleOpenStory = useCallback(async () => {
    if (!matchedPlace) {
      return;
    }

    track('lens_story_opened', { value: matchedPlace.name });

    storyAbortRef.current?.();
    setStoryText('');
    setStoryLoading(true);
    setStoryStreaming(true);
    setStoryMode('monument');
    setIdentifiedObject(null);
    setLocationContext(null);
    storySheetRef.current?.open();

    try {
      const photo = await cameraRef.current?.takePhoto();

      if (!photo) {
        throw new Error('Photo capture failed');
      }

      const imageUri = normalizePhotoUri(photo.path);

      storyAbortRef.current = streamLensStory({
        imageUri,
        monumentName: matchedPlace.name,
        firstName,
        regions,
        latitude: lastKnownCoords?.latitude ?? null,
        longitude: lastKnownCoords?.longitude ?? null,
        mode: 'monument',
        onChunk: chunk => {
          setStoryLoading(false);
          setStoryText(previous => previous + chunk);
        },
        onDone: monument => {
          setStoryLoading(false);
          setStoryStreaming(false);
          track('lens_story_generated', { value: monument });
        },
        onError: () => {
          setStoryLoading(false);
          setStoryStreaming(false);
        },
        onLocationContext: context => {
          setLocationContext(context);
        },
      });
    } catch {
      const fallback = getFallbackStory(regions[0] ?? 'South Asia', firstName);
      setStoryText(fallback.story);
      setStoryLoading(false);
      setStoryStreaming(false);
      track('lens_story_generated', {
        value: fallback.monument,
        source: 'fallback',
      });
    }
  }, [firstName, matchedPlace, regions, lastKnownCoords]);

  const triggerReconstruction = useCallback(
    async (monumentName: string, objectLabel: string) => {
      if (!arEnabled || !objectLabel) {
        return;
      }
      setReconstructionLoading(true);
      setReconstructionQuotaExceeded(false);
      setReconstructionGateError(null);
      try {
        const result = await reconstructForLens({
          monumentId: monumentName,
          objectLabel,
          imageBase64: lastCapturedImageRef.current ?? undefined,
          latitude: lastKnownCoords?.latitude ?? undefined,
          longitude: lastKnownCoords?.longitude ?? undefined,
        });
        if (result.kind === 'success') {
          setReconstructionReady({
            glbUrl: result.glbUrl,
            thumbnailUrl: result.thumbnailUrl,
            provider: result.provider,
            cached: result.cached,
            objectLabel,
            quality: result.quality,
            scanCount: result.scanCount,
          });
          track('lens_reconstruction_ready', {
            monument: monumentName,
            object: objectLabel,
            cached: result.cached ? 'true' : 'false',
            provider: result.provider,
          });
        } else if (result.kind === 'quota_exceeded') {
          setReconstructionQuotaExceeded(true);
          track('lens_reconstruction_quota_hit', {
            plan: result.info.current_plan,
          });
        } else {
          // Backend site gate returns 403 with a human-readable message;
          // surface it to the user instead of swallowing silently.
          if (/heritage site|heritage artefact/i.test(result.message)) {
            setReconstructionGateError(result.message);
          }
          track('lens_reconstruction_error', { message: result.message });
        }
      } finally {
        setReconstructionLoading(false);
      }
    },
    [arEnabled],
  );

  const openReconstruction = useCallback(() => {
    if (!reconstructionReady || !matchedPlace) {
      return;
    }
    navigation.navigate(ROUTES.MAIN.AR_COMPOSER, {
      monumentId: matchedPlace.name,
      objectLabel: reconstructionReady.objectLabel,
      glbUrl: reconstructionReady.glbUrl,
      thumbnailUrl: reconstructionReady.thumbnailUrl,
      cached: reconstructionReady.cached,
      provider: reconstructionReady.provider,
      quality: reconstructionReady.quality,
      scanCount: reconstructionReady.scanCount,
    });
    track('lens_reconstruction_opened', {
      monument: matchedPlace.name,
      object: reconstructionReady.objectLabel,
    });
  }, [navigation, reconstructionReady, matchedPlace]);

  const handleScanObject = useCallback(async () => {
    if (!matchedPlace) {
      return;
    }

    track('lens_object_scan_triggered', {
      monument: matchedPlace.name,
    });

    storyAbortRef.current?.();
    setStoryText('');
    setStoryLoading(true);
    setStoryStreaming(true);
    setStoryMode('object_scan');
    setIdentifiedObject(null);
    setLocationContext(null);
    setIsScanModeActive(true);
    setReconstructionReady(null);
    setReconstructionQuotaExceeded(false);
    lastCapturedImageRef.current = null;

    try {
      const photo = await cameraRef.current?.takePhoto();

      if (!photo) {
        throw new Error('Photo capture failed');
      }

      const imageUri = normalizePhotoUri(photo.path);
      // Keep the base64 around so we can hand it to the reconstruction
      // endpoint once the object is identified in the SSE stream.
      fileToBase64(photo.path)
        .then(b64 => {
          lastCapturedImageRef.current = b64;
        })
        .catch(() => {
          lastCapturedImageRef.current = null;
        });
      storySheetRef.current?.open();

      storyAbortRef.current = streamLensStory({
        imageUri,
        monumentName: matchedPlace.name,
        firstName,
        regions,
        motivation,
        latitude: lastKnownCoords?.latitude ?? null,
        longitude: lastKnownCoords?.longitude ?? null,
        mode: 'object_scan',
        onChunk: chunk => {
          setStoryLoading(false);
          setStoryText(previous => previous + chunk);
        },
        onLocationContext: context => {
          setLocationContext(context);
        },
        onDone: (monument, object) => {
          setStoryLoading(false);
          setStoryStreaming(false);
          setIdentifiedObject(object ?? null);

          if (object) {
            track('lens_object_identified', {
              monument: matchedPlace.name,
              objectName: object?.name ?? 'unknown',
              confidence: 'from_done_event_if_available',
            });

            // Fire reconstruction in parallel; the story UI continues to
            // show immediately and the CTA appears once the GLB is ready.
            void triggerReconstruction(matchedPlace.name, object.name ?? '');
          }

          track('lens_story_generated', {
            value: monument,
            mode: 'object_scan',
          });
        },
        onError: () => {
          setStoryLoading(false);
          setStoryStreaming(false);
        },
      });
    } catch {
      const fallback = getFallbackStory(regions[0] ?? 'South Asia', firstName);
      setStoryText(fallback.story);
      setStoryLoading(false);
      setStoryStreaming(false);
      setIdentifiedObject(null);
      setIsScanModeActive(false);
      storySheetRef.current?.open();
      track('lens_story_generated', {
        value: fallback.monument,
        source: 'fallback',
        mode: 'object_scan',
      });
    }
  }, [firstName, matchedPlace, motivation, regions, triggerReconstruction, lastKnownCoords]);

  const handleIdentify = useCallback(async () => {
    if (geminiLoading) {
      return;
    }

    // Check usage / premium
    const allowed = await checkAndIncrement();
    if (!allowed) {
      navigation.navigate(ROUTES.MAIN.PURCHASE);
      return;
    }

    setGeminiLoading(true);
    setGeminiError(null);
    setGeminiResult(null);
    setIsOfflineResult(false);

    // Offline path: check cache first
    if (!isConnected) {
      try {
        const pos = await new Promise<{ lat: number; lon: number }>(
          (resolve, reject) => {
            Geolocation.getCurrentPosition(
              p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
              reject,
              { timeout: 5000, maximumAge: 30000 },
            );
          },
        );
        const cached = await findCachedResult(pos.lat, pos.lon);
        if (cached) {
          setGeminiResult(cached.identification);
          setIsOfflineResult(true);
          setGeminiLoading(false);
          track('lens_identify_offline_hit', {
            name: cached.identification.name,
          });
          return;
        }
      } catch {
        // GPS failed while offline — fall through to error
      }
      setGeminiError(
        "You're offline — connect to the internet to identify this site",
      );
      setGeminiLoading(false);
      return;
    }

    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) {
        throw new Error('Photo capture failed');
      }

      const imageBase64 = await fileToBase64(photo.path);
      const siteHint = activeZone?.name ?? matchedPlace?.name;
      const result = await identifyHeritage(imageBase64, siteHint);

      if (result.success) {
        setGeminiResult(result.data);
        track('lens_identify_success', { name: result.data.name });
        trackUsageEvent('gemini_identify', activeZone?.id);

        // Log the visit so it counts toward history + personalization signals.
        // Best-effort — never block the identify flow on the visit-log call.
        if (matchedPlace?.id) {
          void logVisit(matchedPlace.id);
        }

        // Cache for offline use (premium only)
        if (canUseOffline) {
          Geolocation.getCurrentPosition(
            pos => {
              void cacheResult(
                result.data,
                pos.coords.latitude,
                pos.coords.longitude,
                matchedPlace?.name,
              );
            },
            () => {}, // Silent — caching is best-effort
            { timeout: 5000, maximumAge: 30000 },
          );
        }
      } else {
        setGeminiError(result.error);
        track('lens_identify_error', { error: result.error });
      }
    } catch {
      setGeminiError(
        "Couldn't identify this site — try holding your phone steady and try again",
      );
    } finally {
      setGeminiLoading(false);
    }
  }, [
    geminiLoading,
    checkAndIncrement,
    isConnected,
    activeZone,
    matchedPlace,
    canUseOffline,
    navigation,
  ]);

  const handleDismissIdentification = useCallback(() => {
    setGeminiResult(null);
    setGeminiError(null);
    setIsOfflineResult(false);
  }, []);

  const handleExpandIdentification = useCallback(() => {
    if (matchedPlace) {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: {
          id: matchedPlace.id,
          name: matchedPlace.name,
          lat: matchedPlace.lat,
          lon: matchedPlace.lon,
          city: matchedPlace.city,
          country: matchedPlace.country,
          formatted: matchedPlace.formatted,
        },
      });
    }
  }, [matchedPlace, navigation]);

  const handleUpgradePremium = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE);
  }, [navigation]);

  const handleHDScan = useCallback(async () => {
    if (hdScanLoading) return;

    if (!canShowMask) {
      navigation.navigate(ROUTES.MAIN.PURCHASE);
      return;
    }

    setHdScanLoading(true);
    setHdMasks([]);

    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) throw new Error('Photo capture failed');

      const token = await getValidAccessToken();
      if (!token) throw new Error('Not authenticated');

      const result = await performHDScan(photo.path, token);
      if (result.success && result.masks.length > 0) {
        setHdMasks(result.masks);
        trackUsageEvent('hd_scan', activeZone?.id);
        track('lens_hd_scan_success', {
          masks: result.masks.length.toString(),
          time_ms: result.inferenceTimeMs.toString(),
        });
      } else if (!result.success) {
        track('lens_hd_scan_error', { error: result.error });
      }
    } catch {
      // Silent — HD scan failures don't show errors
    } finally {
      setHdScanLoading(false);
    }
  }, [hdScanLoading, canShowMask, activeZone?.id, navigation]);

  const handleOpenInfo = useCallback(() => {
    if (!matchedPlace) {
      return;
    }
    track('lens_info_opened', { value: matchedPlace.name });
    infoSheetRef.current?.open();
  }, [matchedPlace]);

  const handleBrowseMonuments = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSearchManually = useCallback(() => {
    searchSheetRef.current?.open();
  }, []);

  const handleSelectPlace = useCallback((place: Place) => {
    setMatchedPlace(place);
    setState('matched');
    setLocationDenied(false);
    setShowRing(false);
    setRingMatched(false);
    track('lens_monument_matched', {
      value: place.name,
      source: 'manual_search',
    });
  }, []);

  const handleArTeaserSeen = useCallback(() => {
    track('lens_ar_teaser_seen', { value: matchedPlace?.name ?? 'unknown' });
  }, [matchedPlace?.name]);

  if (!hasPermission) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.permissionScreen}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Allow camera access to explore heritage sites and uncover your
            ancestor's story.
          </Text>

          <Pressable
            style={styles.permissionPrimaryButton}
            onPress={() => {
              requestPermission().catch(() => {
                // Best-effort prompt.
              });
            }}
          >
            <Text style={styles.permissionPrimaryText}>
              Grant Camera Access
            </Text>
          </Pressable>

          <Pressable
            style={styles.permissionSecondaryButton}
            onPress={() => {
              Linking.openSettings().catch(() => {
                // Best-effort deep link.
              });
            }}
          >
            <Text style={styles.permissionSecondaryText}>Open Settings</Text>
          </Pressable>

          <Pressable
            style={styles.closeLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeLinkText}>Back</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        {device ? (
          <VisionCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            photo
            frameProcessor={isScanModeActive ? frameProcessor : undefined}
          />
        ) : (
          <View style={styles.noDeviceWrap}>
            <ScanEye size={38} color="#E8A020" />
            <Text style={styles.noDeviceText}>
              Camera not available on this device
            </Text>
          </View>
        )}

        {isScanModeActive && segReady && canShowMask ? (
          <SegmentationOverlay
            maskShared={maskShared}
            width={screenWidth}
            height={screenHeight}
          />
        ) : null}

        {hdMasks.length > 0 && (
          <HDScanOverlay
            masks={hdMasks}
            width={screenWidth}
            height={screenHeight}
          />
        )}

        <View style={styles.cameraOverlay} />

        {/* Geofence banner */}
        {activeZone && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={[styles.geofenceBanner, { top: insets.top + 52 }]}
          >
            <MapPin size={14} color="#E8A020" />
            <Text style={styles.geofenceBannerText}>
              You are near {activeZone.name}
            </Text>
          </Animated.View>
        )}

        {/* Gemini identification — 3D AR on ARCore, 2D card fallback */}
        {arAvailable && geminiResult && !geminiLoading ? (
          <EpocheyeARView
            style={StyleSheet.absoluteFill}
            identification={geminiResult}
            arEnabled
            onCardTapped={handleExpandIdentification}
            onARError={() => {}}
          />
        ) : (
          <IdentificationCard
            identification={geminiResult}
            isLoading={geminiLoading}
            error={geminiError}
            isPremium={canShowDetails}
            isOffline={isOfflineResult}
            locationContext={locationContext}
            onDismiss={handleDismissIdentification}
            onExpand={handleExpandIdentification}
            onUpgrade={handleUpgradePremium}
          />
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.topBarTitle}>LENS</Text>
          <Pressable
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close Lens"
          >
            <X size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {showRing ? (
          <PulsingRing
            matched={ringMatched}
            onMatchAnimationComplete={() => {
              setShowRing(false);
            }}
          />
        ) : null}

        <EpochChips visible={state === 'matched'} onPress={handleOpenStory} />

        {/* AR reconstruction CTA — shown after the object_scan SSE identifies an
            object and the reconstruct API returns a GLB. Tapping navigates to
            the dedicated composer screen. */}
        {(reconstructionReady || reconstructionLoading || reconstructionQuotaExceeded || reconstructionGateError) && (
          <View style={[styles.reconstructionBar, { bottom: insets.bottom + 180 }]}>
            <ARQuotaPill compact />
            {reconstructionLoading && (
              <Text style={styles.reconstructionText}>Building 3D model…</Text>
            )}
            {reconstructionReady && !reconstructionLoading && (
              <Pressable style={styles.reconstructionCta} onPress={openReconstruction}>
                <Text style={styles.reconstructionCtaText}>View in 3D</Text>
              </Pressable>
            )}
            {reconstructionQuotaExceeded && (
              <Pressable
                style={styles.reconstructionCta}
                onPress={handleUpgradePremium}
              >
                <Text style={styles.reconstructionCtaText}>Upgrade for more</Text>
              </Pressable>
            )}
            {reconstructionGateError && !reconstructionLoading && (
              <Text style={styles.reconstructionText}>{reconstructionGateError}</Text>
            )}
          </View>
        )}

        <BottomCard
          state={state}
          place={matchedPlace}
          locationDenied={locationDenied}
          onOpenStory={handleOpenStory}
          onOpenInfo={handleOpenInfo}
          onScanObject={handleScanObject}
          onBrowseMonuments={handleBrowseMonuments}
          onSearchManually={handleSearchManually}
          onIdentify={canIdentify ? handleIdentify : undefined}
          identifyLoading={geminiLoading}
          remainingCalls={remainingCalls}
          onHDScan={canShowMask ? handleHDScan : undefined}
          hdScanLoading={hdScanLoading}
        />

        <AncestorStorySheet
          ref={storySheetRef}
          monumentName={matchedPlace?.name ?? 'UNKNOWN MONUMENT'}
          firstName={firstName}
          storyText={storyText}
          isStreaming={storyStreaming}
          isLoading={storyLoading}
          mode={storyMode}
          identifiedObject={identifiedObject}
          onArTeaserSeen={handleArTeaserSeen}
        />

        <MonumentInfoSheet ref={infoSheetRef} place={matchedPlace} />

        <SearchSheet
          ref={searchSheetRef}
          places={nearbyPlaces}
          onSelectPlace={handleSelectPlace}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 4,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 3,
    fontFamily: FONTS.bold,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  geofenceBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 5,
  },
  geofenceBannerText: {
    color: '#E8A020',
    fontSize: 12,
    fontFamily: FONTS.semiBold,
  },
  noDeviceWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0D0D',
  },
  noDeviceText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
    fontFamily: FONTS.bold,
  },
  permissionBody: {
    color: '#8C93A0',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    fontFamily: FONTS.regular,
  },
  permissionPrimaryButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  permissionPrimaryText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  permissionSecondaryButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  permissionSecondaryText: {
    color: '#E8A020',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },
  closeLink: {
    marginTop: 14,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeLinkText: {
    color: '#8C93A0',
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  reconstructionBar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: 'rgba(13,13,13,0.88)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 6,
  },
  reconstructionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: FONTS.medium,
    paddingHorizontal: 4,
  },
  reconstructionCta: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8A020',
    borderRadius: 999,
  },
  reconstructionCtaText: {
    color: '#0D0D0D',
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
});

export default LensScreen;
