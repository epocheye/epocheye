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
import type { UnescoRegion } from '../../constants/onboarding/regions';

const REGION_LABELS: Record<string, string> = {
  asia_pacific: 'Asia & the Pacific',
  arab_states: 'Arab States',
  north_america: 'North America',
  latin_america_caribbean: 'Latin America',
  europe: 'Europe',
  africa: 'Africa',
} satisfies Record<UnescoRegion, string>;
import { useLensPremium } from '../../shared/hooks/useLensPremium';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';
import {
  fileToBase64,
  identifyAny,
  identifyHeritage,
  prepareImageForGemini,
  type GeminiIdentification,
} from '../../services/geminiVisionService';
import {
  detectObjects,
  type DetectedObject,
} from '../../services/geminiObjectDetectionService';
import { useDevSettingsStore } from '../../stores/devSettingsStore';
import ObjectPickerOverlay from './components/ObjectPickerOverlay';
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
import {
  pollReconstructionJob,
  reconstructForLens,
} from '../../services/arReconstructionService';
import type {
  ArReconstructionResult,
  PendingProgress,
} from '../../services/arReconstructionService';
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
import MuseumObjectCard from './components/MuseumObjectCard';
import SitePaywallSheet from './components/SitePaywallSheet';
import { streamMuseumNarration } from '../../services/museumModeService';
import { cropAroundTap } from '../../shared/utils/cropAroundTap';
import {
  useMuseumPrefsStore,
  NARRATION_LANGS,
} from '../../stores/museumPrefsStore';
import EpocheyePlaneARView, {
  type EpocheyePlaneARHandle,
} from '../../native/EpocheyePlaneARView';

type Props = MainScreenProps<'Lens'>;

interface MuseumCardState {
  anchor: { x: number; y: number };
  label: string | null;
  narration: string;
  identifying: boolean;
  streaming: boolean;
  error: string | null;
  /** AR tracking: false when the anchor is off-screen/behind camera. */
  visible: boolean;
}

function formatPendingLabel(phase: string, etaSeconds: number): string {
  const safe = Math.max(0, Math.round(etaSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const eta =
    minutes > 0
      ? `~${minutes}m ${seconds.toString().padStart(2, '0')}s`
      : `~${seconds}s`;
  if (phase === 'cold_start') {
    return `Starting 3D engine… ${eta}`;
  }
  if (phase === 'processing') {
    return `Reconstructing… ${eta}`;
  }
  return `Preparing 3D engine… ${eta}`;
}

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

const LensScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  // Universal museum mode — seed-free tap-to-identify. Entered via route param
  // (Home "explore around you" CTA) OR toggled on from the Lens not-found card.
  const [museumMode, setMuseumMode] = useState(
    route.params?.mode === 'museum',
  );
  const narrationLang = useMuseumPrefsStore(s => s.narrationLang);
  const setNarrationLang = useMuseumPrefsStore(s => s.setNarrationLang);
  const [museumCard, setMuseumCard] = useState<MuseumCardState | null>(null);
  // Per-site free-scan funnel: the paywall (when the allowance is spent) and the
  // remaining-count for the "N free scans left" pill. The server (site_scan_usage)
  // is the source of truth; these just mirror what it reports.
  const [sitePaywall, setSitePaywall] = useState<{
    siteId: string;
    siteName: string | null;
    used: number;
    limit: number;
  } | null>(null);
  const [siteScansRemaining, setSiteScansRemaining] = useState<number | null>(
    null,
  );
  const museumAbortRef = useRef<(() => void) | null>(null);
  const arRef = useRef<EpocheyePlaneARHandle>(null);
  // AR path: the captured frame arrives asynchronously (onFrameCaptured), so we
  // stash the tap fraction + venue context at tap time to use when it lands.
  const museumPendingRef = useRef<{
    xFrac: number;
    yFrac: number;
    venue: string | null;
    lat: number | null;
    lng: number | null;
    venueSlug: string | null;
  } | null>(null);
  const profile = useUser(state => state.profile);
  const nearbyPlaces = usePlaces(state => state.nearbyPlaces);
  const ensureLocationTracking = usePlaces(
    state => state.ensureLocationTracking,
  );
  const storeFirstName = useOnboardingStore(state => state.firstName);
  const storeRegion = useOnboardingStore(state => state.region);

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
  // Async cold-start state: server returned 202 and we're polling until the
  // SAM 3D endpoint warms up.
  const [reconstructionPending, setReconstructionPending] = useState<null | {
    phase: string;
    etaSeconds: number;
    message?: string;
  }>(null);
  const reconstructionAbortedRef = useRef(false);
  const lastCapturedImageRef = useRef<string | null>(null);

  const arEnabled = useArQuotaStore(
    state => state.enabled && !state.maintenanceMode,
  );

  // ── Gemini identification state ──
  const [geminiResult, setGeminiResult] = useState<GeminiIdentification | null>(
    null,
  );
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [activeZone, setActiveZone] = useState<HeritageZone | null>(null);
  const [isOfflineResult, setIsOfflineResult] = useState(false);

  // ── Dev bypass: generic object picker state ──
  const devBypass = useDevSettingsStore(s => s.devBypass);
  const [objectPicker, setObjectPicker] = useState<null | {
    imageBase64: string;
    objects: DetectedObject[];
  }>(null);

  // ── Dev-only: "Describe Anything" pipeline check ──
  // Sends a captured frame to Gemini with a free-form "describe in one sentence"
  // prompt, bypassing the heritage-only template. Used to verify the camera →
  // resize → API path works on any everyday object before site testing.
  const [describeAnythingText, setDescribeAnythingText] = useState<
    string | null
  >(null);
  const [describeAnythingLoading, setDescribeAnythingLoading] = useState(false);

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
  const { arAvailable, arChecked } = useARCore();
  // Museum mode runs through ARCore (world-anchored card) only on AR-capable
  // devices; everything else uses the vision-camera screen-space path.
  const arMuseumActive = museumMode && arChecked && arAvailable;

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

  const regions = useMemo(() => {
    const label = REGION_LABELS[storeRegion ?? ''];
    return label ? [label] : ['South Asia'];
  }, [storeRegion]);

  const motivation = 'heritage_visitor';

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
    return () => {
      // Abort any in-flight reconstruction poll so it doesn't try to update
      // state after the screen unmounts.
      reconstructionAbortedRef.current = true;
    };
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

  const applyReconstructionResult = useCallback(
    (
      result: ArReconstructionResult,
      monumentName: string,
      objectLabel: string,
    ) => {
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
      } else if (result.kind === 'site_paywall') {
        setSitePaywall({
          siteId: result.info.site_id,
          siteName: matchedPlace?.name ?? activeZone?.name ?? null,
          used: result.info.used,
          limit: result.info.limit,
        });
        track('lens_site_paywall_hit', {
          site: result.info.site_id,
          source: 'reconstruct',
        });
      } else if (result.kind === 'quota_exceeded') {
        setReconstructionQuotaExceeded(true);
        track('lens_reconstruction_quota_hit', {
          plan: result.info.current_plan,
        });
      } else if (result.kind === 'error') {
        if (/heritage site|heritage artefact/i.test(result.message)) {
          setReconstructionGateError(result.message);
        }
        track('lens_reconstruction_error', { message: result.message });
      }
    },
    [matchedPlace, activeZone],
  );

  const triggerReconstruction = useCallback(
    async (
      monumentName: string,
      objectLabel: string,
      extras?: {
        imageBase64?: string;
        cropBBox?: [number, number, number, number];
        devBypass?: boolean;
      },
    ) => {
      if (!arEnabled || !objectLabel) {
        return;
      }
      setReconstructionLoading(true);
      setReconstructionQuotaExceeded(false);
      setReconstructionGateError(null);
      setReconstructionPending(null);
      reconstructionAbortedRef.current = false;
      try {
        const result = await reconstructForLens({
          monumentId: monumentName,
          objectLabel,
          imageBase64:
            extras?.imageBase64 ?? lastCapturedImageRef.current ?? undefined,
          latitude: lastKnownCoords?.latitude ?? undefined,
          longitude: lastKnownCoords?.longitude ?? undefined,
          cropBBox: extras?.cropBBox,
          devBypass: extras?.devBypass,
        });

        if (result.kind === 'pending') {
          // SAM 3D endpoint is cold or warming — poll the status endpoint
          // until it flips to succeeded/failed. Keep the loading bar up so
          // the user sees "Preparing 3D engine…" until the GLB lands.
          setReconstructionPending({
            phase: result.phase,
            etaSeconds: result.etaSeconds,
            message: result.message,
          });
          track('lens_reconstruction_pending', {
            monument: monumentName,
            object: objectLabel,
            phase: result.phase,
          });
          const final = await pollReconstructionJob(result.jobId, {
            isAborted: () => reconstructionAbortedRef.current,
            onProgress: (p: PendingProgress) =>
              setReconstructionPending(prev =>
                prev
                  ? { ...prev, phase: p.phase, etaSeconds: p.etaSeconds }
                  : prev,
              ),
          });
          setReconstructionPending(null);
          applyReconstructionResult(final, monumentName, objectLabel);
          return;
        }

        applyReconstructionResult(result, monumentName, objectLabel);
      } finally {
        setReconstructionLoading(false);
      }
    },
    [arEnabled, applyReconstructionResult, lastKnownCoords],
  );

  const openReconstruction = useCallback(() => {
    if (!reconstructionReady) {
      return;
    }
    const testCtx = testModeCtxRef.current;
    // Dev-bypass scans don't have a matchedPlace — use the generic object
    // name as the monument id label so the viewer can still render.
    const monumentLabel = testCtx ? testCtx.name : matchedPlace?.name;
    if (!monumentLabel) {
      return;
    }
    navigation.navigate(ROUTES.MAIN.AR_COMPOSER, {
      monumentId: monumentLabel,
      objectLabel: reconstructionReady.objectLabel,
      glbUrl: reconstructionReady.glbUrl,
      thumbnailUrl: reconstructionReady.thumbnailUrl,
      cached: reconstructionReady.cached,
      provider: reconstructionReady.provider,
      quality: reconstructionReady.quality,
      scanCount: reconstructionReady.scanCount,
      isTestMode: testCtx !== null,
      testObjectDescription: testCtx?.description,
    });
    track('lens_reconstruction_opened', {
      monument: monumentLabel,
      object: reconstructionReady.objectLabel,
      test_mode: testCtx ? 'true' : 'false',
    });
    // Clear the test-mode context after navigation so a subsequent
    // heritage scan lands in the default card.
    testModeCtxRef.current = null;
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
    setReconstructionPending(null);
    reconstructionAbortedRef.current = true;
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
  }, [
    firstName,
    matchedPlace,
    motivation,
    regions,
    triggerReconstruction,
    lastKnownCoords,
  ]);

  const handleIdentify = useCallback(async () => {
    if (geminiLoading) {
      return;
    }

    // Dev bypass path: skip heritage identification, run generic object
    // detection and let the user tap an object to reconstruct. Still costs
    // a quota slot so the server-side quota stays honest.
    if (devBypass) {
      const allowed = await checkAndIncrement();
      if (!allowed) {
        navigation.navigate(ROUTES.MAIN.PURCHASE);
        return;
      }
      setGeminiLoading(true);
      setGeminiError(null);
      setGeminiResult(null);
      try {
        const photo = await cameraRef.current?.takePhoto();
        if (!photo) throw new Error('Photo capture failed');
        const imageBase64 = await prepareImageForGemini(photo.path);
        const detection = await detectObjects(imageBase64);
        if (!detection.success) {
          setGeminiError(detection.error);
          return;
        }
        setObjectPicker({ imageBase64, objects: detection.data });
      } catch (err) {
        if (__DEV__) {
          console.warn('[LensScreen.identify.devBypass]', err);
        }
        setGeminiError('Detection failed — hold steady and try again');
      } finally {
        setGeminiLoading(false);
      }
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

    let preparedBase64: string | null = null;
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) {
        throw new Error('Photo capture failed');
      }

      preparedBase64 = await prepareImageForGemini(photo.path);
      const siteHint = activeZone?.name ?? matchedPlace?.name;
      const result = await identifyHeritage(preparedBase64, siteHint);

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
        if (__DEV__) {
          console.warn(
            `[LensScreen.identify] failure code=${result.code} error=${result.error}`,
          );
          // Plain-text probe isolates whether the API path works at all.
          void identifyAny(preparedBase64).then(probe => {
            console.log('[LensScreen.identify] identifyAny probe:', probe);
          });
        }
        setGeminiError(result.error);
        track('lens_identify_error', {
          error: result.error,
          code: result.code,
        });
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[LensScreen.identify]', err);
      }
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
    devBypass,
  ]);

  // Dev bypass: tracks the last test-mode reconstruction context so that
  // the generic object name + description can accompany the 3D view.
  const testModeCtxRef = useRef<{ name: string; description: string } | null>(
    null,
  );

  // Dev bypass: auto-fire object detection once when Lens opens.
  // The 800ms delay lets vision-camera fully initialize before takePhoto;
  // capturing too early returns a black/empty frame on some Android devices.
  const autoDetectFiredRef = useRef(false);
  useEffect(() => {
    if (!devBypass || autoDetectFiredRef.current || !hasPermission || !device) {
      return;
    }
    autoDetectFiredRef.current = true;
    const t = setTimeout(() => {
      void handleIdentify();
    }, 800);
    return () => clearTimeout(t);
  }, [devBypass, hasPermission, device, handleIdentify]);

  const handleObjectPickerConfirm = useCallback(
    async (obj: DetectedObject) => {
      if (!objectPicker) return;
      testModeCtxRef.current = { name: obj.name, description: obj.description };
      const imageBase64 = objectPicker.imageBase64;
      setObjectPicker(null);
      lastCapturedImageRef.current = imageBase64;
      await triggerReconstruction('dev-test', obj.name, {
        imageBase64,
        cropBBox: obj.box_2d,
        devBypass: true,
      });
    },
    [objectPicker, triggerReconstruction],
  );

  const handleDismissIdentification = useCallback(() => {
    setGeminiResult(null);
    setGeminiError(null);
    setIsOfflineResult(false);
  }, []);

  // Shared: kick off the identify + hedged-narration SSE for a captured frame.
  // ONE backend request per tap (the cost control — no continuous scanning);
  // the backend does the cheap identify + cache-gated narration. Used by both
  // the vision-camera path (non-AR) and the ARCore path (AR devices).
  const startMuseumNarration = useCallback(
    (
      imageUri: string,
      ctx?: {
        venue?: string | null;
        lat?: number | null;
        lng?: number | null;
        venueSlug?: string | null;
      },
    ) => {
      museumAbortRef.current = streamMuseumNarration({
        imageUri,
        venue: ctx?.venue ?? null,
        lat: ctx?.lat ?? null,
        lng: ctx?.lng ?? null,
        venueSlug: ctx?.venueSlug ?? null,
        lang: narrationLang,
        onObject: label =>
          setMuseumCard(c =>
            c ? { ...c, label, identifying: false, streaming: true } : c,
          ),
        onChunk: text =>
          setMuseumCard(c =>
            c ? { ...c, narration: c.narration + text, identifying: false } : c,
          ),
        onDone: info => {
          setMuseumCard(c =>
            c ? { ...c, identifying: false, streaming: false } : c,
          );
          track('museum_identified', { cached: info.cached ? 'true' : 'false' });
        },
        onError: message =>
          setMuseumCard(c =>
            c
              ? {
                  ...c,
                  identifying: false,
                  streaming: false,
                  error:
                    message ?? "Couldn't identify this — try another angle",
                }
              : c,
          ),
        onPaywall: info => {
          // Free scans at this venue are spent — drop the identify card and
          // surface the conversion paywall for this site.
          museumAbortRef.current = null;
          setMuseumCard(null);
          setSitePaywall({
            siteId: info.siteId,
            siteName: matchedPlace?.name ?? activeZone?.name ?? null,
            used: info.used,
            limit: info.limit,
          });
          track('lens_site_paywall_hit', {site: info.siteId, source: 'museum'});
        },
        onScanMeta: info => setSiteScansRemaining(info.remaining),
      });
    },
    [narrationLang, matchedPlace, activeZone],
  );

  // Venue/coords available at scan time: nearest place name (from /findplaces
  // detection) + GPS. Optional — improves specificity, fine when absent.
  const museumContext = useCallback(
    () => ({
      venue: matchedPlace?.name ?? null,
      lat: lastKnownCoords?.latitude ?? null,
      lng: lastKnownCoords?.longitude ?? null,
      // Seeded-venue slug (when inside a curated zone) → grounded matching.
      venueSlug: activeZone?.monument_id ?? null,
    }),
    [matchedPlace, lastKnownCoords, activeZone],
  );

  // Non-AR (vision-camera) tap: capture via takePhoto → crop to the tap →
  // narrate. Card pinned to the tap point.
  const handleMuseumTap = useCallback(
    async (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      const x = evt.nativeEvent.locationX;
      const y = evt.nativeEvent.locationY;
      museumAbortRef.current?.();
      setMuseumCard({
        anchor: { x, y },
        label: null,
        narration: '',
        identifying: true,
        streaming: false,
        error: null,
        visible: true,
      });
      track('museum_tap', { mode: 'screen' });

      const ctx = museumContext();
      const xFrac = screenWidth > 0 ? x / screenWidth : 0.5;
      const yFrac = screenHeight > 0 ? y / screenHeight : 0.5;
      try {
        const photo = await cameraRef.current?.takePhoto();
        if (!photo) {
          throw new Error('capture failed');
        }
        const cropped = await cropAroundTap(
          normalizePhotoUri(photo.path),
          xFrac,
          yFrac,
        );
        startMuseumNarration(cropped, ctx);
      } catch {
        setMuseumCard(c =>
          c
            ? {
                ...c,
                identifying: false,
                streaming: false,
                error: "Couldn't capture — hold steady and tap again",
              }
            : c,
        );
      }
    },
    [startMuseumNarration, museumContext, screenWidth, screenHeight],
  );

  // AR tap: lock a world anchor at the tap + ask native to grab the frame.
  // Stash the tap fraction + context for when onFrameCaptured lands; narration
  // starts then, and the card follows onAnchorScreenPos.
  const handleMuseumTapAR = useCallback(
    (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
      const x = evt.nativeEvent.locationX;
      const y = evt.nativeEvent.locationY;
      museumAbortRef.current?.();
      setMuseumCard({
        anchor: { x, y },
        label: null,
        narration: '',
        identifying: true,
        streaming: false,
        error: null,
        visible: true,
      });
      track('museum_tap', { mode: 'ar' });
      const ctx = museumContext();
      museumPendingRef.current = {
        xFrac: screenWidth > 0 ? x / screenWidth : 0.5,
        yFrac: screenHeight > 0 ? y / screenHeight : 0.5,
        venue: ctx.venue,
        lat: ctx.lat,
        lng: ctx.lng,
        venueSlug: ctx.venueSlug,
      };
      arRef.current?.placeAnchor(x, y);
      arRef.current?.captureFrame();
    },
    [museumContext, screenWidth, screenHeight],
  );

  const handleMuseumFrameCaptured = useCallback(
    async (uri: string) => {
      const p = museumPendingRef.current;
      const cropped = await cropAroundTap(
        uri,
        p?.xFrac ?? 0.5,
        p?.yFrac ?? 0.5,
      );
      startMuseumNarration(
        cropped,
        p
          ? { venue: p.venue, lat: p.lat, lng: p.lng, venueSlug: p.venueSlug }
          : undefined,
      );
    },
    [startMuseumNarration],
  );

  const handleMuseumAnchorPos = useCallback(
    (x: number, y: number, visible: boolean) => {
      setMuseumCard(c => (c ? { ...c, anchor: { x, y }, visible } : c));
    },
    [],
  );

  const handleMuseumDismiss = useCallback(() => {
    museumAbortRef.current?.();
    museumAbortRef.current = null;
    arRef.current?.clearAnchor();
    setMuseumCard(null);
  }, []);

  // Abort any in-flight museum stream on unmount.
  useEffect(() => {
    return () => {
      museumAbortRef.current?.();
    };
  }, []);

  const handleDescribeAnything = useCallback(async () => {
    if (describeAnythingLoading) return;
    setDescribeAnythingLoading(true);
    setDescribeAnythingText(null);
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) {
        setDescribeAnythingText('Couldn’t capture a photo — try again');
        return;
      }
      const prepared = await prepareImageForGemini(photo.path);
      const probe = await identifyAny(prepared);
      if (probe.success) {
        setDescribeAnythingText(probe.text);
      } else {
        setDescribeAnythingText(`Probe failed: ${probe.error}`);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[LensScreen.describeAnything]', err);
      }
      setDescribeAnythingText('Probe threw — see Metro logs');
    } finally {
      setDescribeAnythingLoading(false);
    }
  }, [describeAnythingLoading]);

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
      <GestureHandlerRootView className="flex-1 bg-grey-dark">
        <View className="flex-1 bg-grey-dark justify-center px-6">
          <Text className="text-parchment text-[22px] leading-[30px] text-center font-montserrat-bold">
            Camera access needed
          </Text>
          <Text className="text-grey-muted text-[14px] leading-[22px] text-center mt-[10px] font-montserrat">
            Allow camera access to explore heritage sites and uncover your
            ancestor's story.
          </Text>

          <Pressable
            className="h-[50px] rounded-xl bg-accent-amber items-center justify-center mt-6"
            onPress={() => {
              requestPermission().catch(() => {
                // Best-effort prompt.
              });
            }}
          >
            <Text className="text-[#0D0D0D] text-[15px] font-montserrat-bold">
              Grant Camera Access
            </Text>
          </Pressable>

          <Pressable
            className="h-[50px] rounded-xl border-[1.5px] border-accent-amber items-center justify-center mt-3"
            onPress={() => {
              Linking.openSettings().catch(() => {
                // Best-effort deep link.
              });
            }}
          >
            <Text className="text-accent-amber text-[15px] font-montserrat-semibold">
              Open Settings
            </Text>
          </Pressable>

          <Pressable
            className="mt-[14px] self-center px-[10px] py-[6px]"
            onPress={() => navigation.goBack()}
          >
            <Text className="text-grey-muted text-[13px] font-montserrat">Back</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1 bg-grey-dark">
      <View className="flex-1 bg-black">
        {/* Camera layer. Museum mode on an AR-capable device swaps the
            vision-camera for ARCore (it must own the camera to track + anchor);
            everything else keeps vision-camera. While the ARCore capability
            check is in flight in museum mode we hold a neutral layer to avoid
            mounting then tearing down vision-camera. */}
        {arMuseumActive ? (
          <EpocheyePlaneARView
            ref={arRef}
            style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
            onFrameCaptured={handleMuseumFrameCaptured}
            onAnchorScreenPos={handleMuseumAnchorPos}
            onError={msg => {
              setMuseumCard(c =>
                c
                  ? { ...c, identifying: false, streaming: false, error: msg }
                  : c,
              );
            }}
          />
        ) : museumMode && !arChecked ? (
          <View className="absolute inset-0 items-center justify-center bg-grey-dark">
            <ScanEye size={38} color="#E8A020" />
            <Text className="mt-3 text-parchment text-[15px] font-montserrat-medium">
              Starting…
            </Text>
          </View>
        ) : device ? (
          <VisionCamera
            ref={cameraRef}
            style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
            device={device}
            isActive
            photo
            frameProcessor={isScanModeActive ? frameProcessor : undefined}
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center bg-grey-dark">
            <ScanEye size={38} color="#E8A020" />
            <Text className="mt-3 text-parchment text-[15px] font-montserrat-medium">
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

        <View className="absolute inset-0 bg-[rgba(0,0,0,0.08)]" />

        {/* ── Museum mode: seed-free tap-to-identify ───────────────────── */}
        {museumMode && (
          <>
            {/* Tap target. Rendered below the top bar (which is a later sibling
                with higher z) so the close button keeps working. ONE identify
                per tap — no continuous scanning. AR devices route the tap to a
                world anchor + native frame capture; others use takePhoto. */}
            <Pressable
              className="absolute inset-0"
              onPress={arMuseumActive ? handleMuseumTapAR : handleMuseumTap}
              accessibilityRole="button"
              accessibilityLabel="Tap an object to identify it"
            />

            {/* Narration-language selector (En · हिन्दी · বাংলা). Persisted; the
                next tap narrates in the chosen language. */}
            <View
              className="absolute self-center flex-row items-center gap-x-1 bg-[rgba(13,13,13,0.82)] rounded-full border border-[rgba(255,255,255,0.14)] p-1"
              style={{ top: insets.top + 52 }}
            >
              {NARRATION_LANGS.map(({ code, label }) => {
                const active = narrationLang === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setNarrationLang(code)}
                    accessibilityRole="button"
                    accessibilityLabel={`Narration language ${label}`}
                    accessibilityState={{ selected: active }}
                    className={`px-3 py-[5px] rounded-full${active ? ' bg-accent-amber' : ''}`}
                  >
                    <Text
                      className={`text-[12px] font-montserrat-semibold ${active ? 'text-[#0D0D0D]' : 'text-parchment'}`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Free-scan counter — gentle urgency during the free period. Fed by
                the server's scan_meta (per-site allowance is server-enforced). */}
            {siteScansRemaining !== null && (
              <View
                pointerEvents="none"
                className="absolute self-center flex-row items-center gap-x-2 bg-[rgba(13,13,13,0.82)] rounded-full border border-[rgba(232,160,32,0.4)] px-3 py-[5px]"
                style={{ top: insets.top + 92 }}
              >
                <ScanEye size={13} color="#E8A020" />
                <Text className="text-accent-amber text-[12px] font-montserrat-semibold">
                  {siteScansRemaining <= 0
                    ? 'No free scans left here'
                    : `${siteScansRemaining} free ${
                        siteScansRemaining === 1 ? 'scan' : 'scans'
                      } left${matchedPlace?.name ? ` at ${matchedPlace.name}` : ''}`}
                </Text>
              </View>
            )}

            {!museumCard && (
              <View
                pointerEvents="none"
                className="absolute self-center flex-row items-center gap-x-2 bg-[rgba(13,13,13,0.82)] rounded-[20px] border border-[rgba(232,160,32,0.4)] px-[14px] py-2"
                style={{ bottom: insets.bottom + 80 }}
              >
                <ScanEye size={14} color="#E8A020" />
                <Text className="text-accent-amber text-[12px] font-montserrat-semibold">
                  {arMuseumActive
                    ? 'Tap an object — it stays pinned in 3D'
                    : 'Tap any object to explore it'}
                </Text>
              </View>
            )}

            {/* On AR devices the card follows the world anchor (position +
                visibility come from onAnchorScreenPos). On non-AR devices it
                sits at the tap point (visible always true). */}
            {museumCard && (
              <MuseumObjectCard {...museumCard} onDismiss={handleMuseumDismiss} />
            )}
          </>
        )}

        {/* Geofence banner */}
        {activeZone && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="absolute self-center flex-row items-center gap-x-[6px] bg-[rgba(13,13,13,0.82)] rounded-[20px] border border-[rgba(232,160,32,0.4)] px-[14px] py-2 z-[5]"
            style={{top: insets.top + 52}}
          >
            <MapPin size={14} color="#E8A020" />
            <Text className="text-accent-amber text-[12px] font-montserrat-semibold">
              You are near {activeZone.name}
            </Text>
          </Animated.View>
        )}

        {/* Gemini identification — 3D AR on ARCore, 2D card fallback.
            Suppressed in museum mode (which owns the whole surface). */}
        {!museumMode &&
          (arAvailable && geminiResult && !geminiLoading ? (
            <EpocheyeARView
              style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
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
          ))}

        <View
          className="absolute left-0 right-0 top-0 z-[4] px-4 pb-3 bg-[rgba(0,0,0,0.35)] flex-row items-center justify-between"
          style={{paddingTop: insets.top + 10}}
        >
          <Text className="text-parchment text-[13px] tracking-[3px] font-montserrat-bold">LENS</Text>
          <View className="flex-row items-center gap-2">
            {__DEV__ && (
              <View
                className={`px-[10px] py-[6px] rounded-full border ${devBypass ? 'bg-[rgba(72,187,120,0.18)] border-[rgba(72,187,120,0.7)]' : 'bg-[rgba(120,120,120,0.15)] border-[rgba(180,180,180,0.4)]'}`}
              >
                <Text
                  className={`text-[10px] tracking-[1.2px] font-montserrat-bold ${devBypass ? 'text-[#48BB78]' : 'text-accent-amber'}`}
                >
                  BYPASS: {devBypass ? 'ON' : 'OFF'}
                </Text>
              </View>
            )}
            {__DEV__ && (
              <Pressable
                className="px-[10px] py-[6px] rounded-full bg-[rgba(232,160,32,0.18)] border border-[rgba(232,160,32,0.6)]"
                style={describeAnythingLoading ? {opacity: 0.6} : undefined}
                onPress={handleDescribeAnything}
                disabled={describeAnythingLoading}
                accessibilityRole="button"
                accessibilityLabel="Describe anything (dev)"
              >
                <Text className="text-accent-amber text-[10px] tracking-[1.2px] font-montserrat-bold">
                  {describeAnythingLoading ? 'PROBING…' : 'DEV: DESCRIBE'}
                </Text>
              </Pressable>
            )}
            <Pressable
              className="w-[34px] h-[34px] rounded-full items-center justify-center bg-[rgba(255,255,255,0.08)]"
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Close Lens"
            >
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {__DEV__ && describeAnythingText && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="absolute left-4 right-4 z-[5] flex-row items-center gap-[10px] px-3 py-[10px] rounded-xl bg-[rgba(10,10,10,0.92)] border border-[rgba(232,160,32,0.4)]"
            style={{top: insets.top + 56}}
          >
            <Text className="text-accent-amber text-[9px] tracking-[1.4px] font-montserrat-bold">DEV PROBE</Text>
            <Text className="flex-1 text-parchment text-[12px] font-montserrat leading-[16px]">
              {describeAnythingText}
            </Text>
            <Pressable
              onPress={() => setDescribeAnythingText(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss probe result"
              hitSlop={8}
            >
              <X size={14} color="#F5F0E8" />
            </Pressable>
          </Animated.View>
        )}

        {showRing ? (
          <PulsingRing
            matched={ringMatched}
            onMatchAnimationComplete={() => {
              setShowRing(false);
            }}
          />
        ) : null}

        {!museumMode && (
          <EpochChips visible={state === 'matched'} onPress={handleOpenStory} />
        )}

        {/* AR reconstruction CTA — shown after the object_scan SSE identifies an
            object and the reconstruct API returns a GLB. Tapping navigates to
            the dedicated composer screen. */}
        {!museumMode &&
          (reconstructionReady ||
          reconstructionLoading ||
          reconstructionPending ||
          reconstructionQuotaExceeded ||
          reconstructionGateError) && (
          <View
            className="absolute self-center flex-row items-center gap-x-[10px] bg-[rgba(13,13,13,0.88)] rounded-full border border-[rgba(232,160,32,0.3)] px-[10px] py-[6px] z-[6]"
            style={{bottom: insets.bottom + 180}}
          >
            <ARQuotaPill compact />
            {reconstructionPending ? (
              <Text className="text-parchment text-[12px] font-montserrat-medium px-1">
                {formatPendingLabel(
                  reconstructionPending.phase,
                  reconstructionPending.etaSeconds,
                )}
              </Text>
            ) : (
              reconstructionLoading && (
                <Text className="text-parchment text-[12px] font-montserrat-medium px-1">
                  Building 3D model…
                </Text>
              )
            )}
            {reconstructionReady && !reconstructionLoading && (
              <Pressable
                className="px-3 py-[6px] bg-accent-amber rounded-full"
                onPress={openReconstruction}
              >
                <Text className="text-[#0D0D0D] text-[12px] font-montserrat-bold">View in 3D</Text>
              </Pressable>
            )}
            {reconstructionQuotaExceeded && (
              <Pressable
                className="px-3 py-[6px] bg-accent-amber rounded-full"
                onPress={handleUpgradePremium}
              >
                <Text className="text-[#0D0D0D] text-[12px] font-montserrat-bold">
                  Upgrade for more
                </Text>
              </Pressable>
            )}
            {reconstructionGateError && !reconstructionLoading && (
              <Text className="text-parchment text-[12px] font-montserrat-medium px-1">
                {reconstructionGateError}
              </Text>
            )}
          </View>
        )}

        {!museumMode && (
          <BottomCard
            state={state}
            place={matchedPlace}
            locationDenied={locationDenied}
            onOpenStory={handleOpenStory}
            onOpenInfo={handleOpenInfo}
            onScanObject={handleScanObject}
            onBrowseMonuments={handleBrowseMonuments}
            onSearchManually={handleSearchManually}
            onIdentify={canIdentify || devBypass ? handleIdentify : undefined}
            identifyLoading={geminiLoading}
            remainingCalls={remainingCalls}
            onHDScan={canShowMask ? handleHDScan : undefined}
            hdScanLoading={hdScanLoading}
            onExploreAround={() => setMuseumMode(true)}
            onExploreArtifacts={() => setMuseumMode(true)}
          />
        )}

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

        {objectPicker && (
          <ObjectPickerOverlay
            imageBase64={objectPicker.imageBase64}
            objects={objectPicker.objects}
            onCancel={() => setObjectPicker(null)}
            onConfirm={handleObjectPickerConfirm}
          />
        )}

        {/* Per-site paywall — appears when free scans run out (museum tap or AR
            reconstruct). Leads into the existing Explorer Pass purchase flow. */}
        {sitePaywall && (
          <SitePaywallSheet
            visible
            siteId={sitePaywall.siteId}
            siteName={sitePaywall.siteName ?? undefined}
            limit={sitePaywall.limit}
            onClose={() => setSitePaywall(null)}
            onUnlocked={() => {
              setSitePaywall(null);
              setSiteScansRemaining(null);
              track('lens_site_unlocked', {site: sitePaywall.siteId});
            }}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
};

export default LensScreen;
