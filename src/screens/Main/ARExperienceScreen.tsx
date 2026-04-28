/**
 * ARExperienceScreen
 *
 * Monument-specific AR experience that extends the Lens pipeline.
 * Receives a site via route params and provides:
 * - Live VisionCamera feed with segmentation overlay
 * - Gemini-powered object identification
 * - Geofence-aware AR anchoring (ARCore on Android)
 * - Historical timeline from personalized facts API
 * - HD scan for premium users
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  ScanEye,
  Sparkles,
  X,
} from 'lucide-react-native';

import { useGeminiIdentification } from '../../shared/hooks/useGeminiIdentification';
import { useARCore } from '../../shared/hooks/useARCore';
import { getActiveZone } from '../../services/geofenceService';
import { fetchZones } from '../../services/zoneService';
import { getPersonalizedFacts } from '../../utils/api/user';
import type { PersonalizedFact } from '../../utils/api/user';
import { useUser } from '../../context';
import { performHDScan, type HDScanMask } from '../../services/hdScanService';
import { getValidAccessToken } from '../../utils/api/auth';
import { trackUsageEvent } from '../../services/usageTelemetryService';
import { ROUTES } from '../../core/constants';
import type { MainScreenProps } from '../../core/types/navigation.types';
import type { HeritageZone } from '../../core/config/geofence.types';

import { useDevSettingsStore } from '../../stores/devSettingsStore';
import {
  detectObjects,
  type DetectedObject,
} from '../../services/geminiObjectDetectionService';
import {
  identifyAny,
  prepareImageForGemini,
} from '../../services/geminiVisionService';
import {
  pollReconstructionJob,
  recognizeForLens,
  reconstructForLens,
  type ArReconstructionResult,
  type PendingProgress,
} from '../../services/arReconstructionService';
import { submitUnknownScan } from '../../utils/api/ar';
import { isArcoreAvailable } from '../../services/arcoreService';
import { useArQuotaStore } from '../../stores/arQuotaStore';

import EpocheyeARView from '../../native/EpocheyeARView';
import IdentificationCard from '../Lens/components/IdentificationCard';
import HDScanOverlay from '../Lens/components/HDScanOverlay';
import ObjectPickerOverlay from '../Lens/components/ObjectPickerOverlay';

type Props = MainScreenProps<'ARExperience'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ARExperienceScreen: React.FC<Props> = ({ navigation, route }) => {
  const site = route.params.site;
  const insets = useSafeAreaInsets();
  const profile = useUser(state => state.profile);
  const cameraRef = useRef<VisionCamera | null>(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { arAvailable } = useARCore();
  const isFocused = useIsFocused();
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Geofence state
  const [activeZone, setActiveZone] = useState<HeritageZone | null>(null);

  // Timeline state
  const [timelineFacts, setTimelineFacts] = useState<PersonalizedFact[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const timelineHeight = useSharedValue(100);

  // HD scan state
  const [hdMasks, setHdMasks] = useState<HDScanMask[]>([]);
  const [hdScanLoading, setHdScanLoading] = useState(false);

  // Info modal
  const [showInfo, setShowInfo] = useState(false);

  // ── Dev bypass: generic multi-object detection workflow ──
  const devBypass = useDevSettingsStore(s => s.devBypass);
  const arEnabled = useArQuotaStore(s => s.enabled && !s.maintenanceMode);
  const [objectPicker, setObjectPicker] = useState<null | {
    imageBase64: string;
    objects: DetectedObject[];
  }>(null);
  const [bypassLoading, setBypassLoading] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);
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
  const [reconstructionPending, setReconstructionPending] = useState<null | {
    phase: string;
    etaSeconds: number;
  }>(null);
  // "Help us add this" prompt — set when recognise returns match='unknown'.
  const [unknownPrompt, setUnknownPrompt] = useState<null | {
    imageBase64: string;
    lat: number;
    lng: number;
    knowledgeText?: string;
  }>(null);
  const reconstructionAbortedRef = useRef(false);
  const testCtxRef = useRef<{ name: string; description: string } | null>(null);
  const autoDetectFiredRef = useRef(false);

  // ── Dev probe ("Describe Anything") ──
  const [describeAnythingText, setDescribeAnythingText] = useState<string | null>(
    null,
  );
  const [describeAnythingLoading, setDescribeAnythingLoading] = useState(false);

  // Gemini identification hook
  const {
    result: geminiResult,
    loading: geminiLoading,
    error: geminiError,
    isOfflineResult,
    identify,
    dismiss: dismissIdentification,
    canIdentify,
    canShowMask,
    canShowDetails,
    remainingCalls,
  } = useGeminiIdentification({
    siteHint: site.name,
    zoneId: activeZone?.id,
  });

  // Check geofence on mount
  useEffect(() => {
    void fetchZones();

    if (site.lat != null && site.lon != null) {
      const zone = getActiveZone(site.lat, site.lon);
      setActiveZone(zone);
    }
  }, [site.lat, site.lon]);

  // Request permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch(() => {});
    }
  }, [hasPermission, requestPermission]);

  // Load timeline facts
  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      setTimelineLoading(true);
      const result = await getPersonalizedFacts({
        userName: profile?.name ?? 'Explorer',
        nearbyPlaces: [site.name],
        limit: 5,
      });
      if (!cancelled && result.success) {
        setTimelineFacts(result.data.facts);
      }
      if (!cancelled) {
        setTimelineLoading(false);
      }
    }

    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [site.name, profile?.name]);

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
      } else if (result.kind === 'error') {
        setBypassError(result.message);
      }
    },
    [],
  );

  const triggerReconstruction = useCallback(
    async (
      monumentName: string,
      objectLabel: string,
      extras: {
        imageBase64: string;
        cropBBox?: [number, number, number, number];
      },
    ) => {
      if (!arEnabled || !objectLabel) return;
      setReconstructionLoading(true);
      setReconstructionPending(null);
      reconstructionAbortedRef.current = false;
      try {
        const result = await reconstructForLens({
          monumentId: monumentName,
          objectLabel,
          imageBase64: extras.imageBase64,
          cropBBox: extras.cropBBox,
          devBypass: true,
        });
        if (result.kind === 'pending') {
          setReconstructionPending({
            phase: result.phase,
            etaSeconds: result.etaSeconds,
          });
          const final = await pollReconstructionJob(result.jobId, {
            isAborted: () => reconstructionAbortedRef.current,
            onProgress: (p: PendingProgress) =>
              setReconstructionPending(prev =>
                prev ? { ...prev, phase: p.phase, etaSeconds: p.etaSeconds } : prev,
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
    [arEnabled, applyReconstructionResult],
  );

  const runDevBypassDetection = useCallback(async () => {
    if (bypassLoading) return;
    setBypassLoading(true);
    setBypassError(null);
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) throw new Error('Photo capture failed');
      const imageBase64 = await prepareImageForGemini(photo.path);
      const detection = await detectObjects(imageBase64);
      if (!detection.success) {
        setBypassError(detection.error);
        return;
      }
      setObjectPicker({ imageBase64, objects: detection.data });
    } catch (err) {
      if (__DEV__) console.warn('[ARExperience.devBypass]', err);
      setBypassError('Detection failed — hold steady and try again');
    } finally {
      setBypassLoading(false);
    }
  }, [bypassLoading]);

  const handleIdentify = useCallback(async () => {
    if (devBypass) {
      await runDevBypassDetection();
      return;
    }
    if (!canIdentify) {
      navigation.navigate(ROUTES.MAIN.PURCHASE);
      return;
    }
    await identify(cameraRef);
  }, [devBypass, runDevBypassDetection, canIdentify, identify, navigation]);

  const handleObjectPickerConfirm = useCallback(
    async (obj: DetectedObject) => {
      if (!objectPicker) return;
      testCtxRef.current = { name: obj.name, description: obj.description };
      const imageBase64 = objectPicker.imageBase64;
      setObjectPicker(null);
      // Production catalog flow when we're at a real heritage site (geofence
      // active) — Gemini classifies against the curated asset catalog and the
      // backend resolves the placement. Falls back to the legacy reconstruct
      // pipeline only in dev BYPASS mode (home testing without a curated site).
      if (!devBypass) {
        await triggerCatalogRecognize(imageBase64);
        return;
      }
      await triggerReconstruction(site.name, obj.name, {
        imageBase64,
        cropBBox: obj.box_2d,
      });
    },
    // triggerCatalogRecognize is declared below; eslint-react-hooks accepts
    // forward references in useCallback when the dependency is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [objectPicker, triggerReconstruction, site.name, devBypass],
  );

  // Catalog-mode recognition path. Called when the user picks an object at
  // a real heritage site. Captures GPS, checks ARCore availability, calls
  // recognizeForLens, branches on place_strategy:
  //   - placed/runtime_persisted/pose_fallback → set the AR composer state
  //   - viewer_only → push to the 3D viewer screen
  //   - unknown → prompt for "Help us add this" submission
  const triggerCatalogRecognize = useCallback(
    async (imageBase64: string) => {
      setReconstructionLoading(true);
      setReconstructionPending(null);
      try {
        const arSupported = await isArcoreAvailable();
        const lat = (site as { lat?: number; latitude?: number }).lat
          ?? (site as { latitude?: number }).latitude
          ?? 0;
        const lng = (site as { lng?: number; longitude?: number }).lng
          ?? (site as { longitude?: number }).longitude
          ?? 0;

        const outcome = await recognizeForLens({
          monumentId: site.name,
          lat,
          lng,
          imageBase64,
          arSupported,
        });

        if (outcome.kind === 'error') {
          setBypassError(outcome.message);
          return;
        }
        if (outcome.kind === 'unknown') {
          setUnknownPrompt({ imageBase64, lat, lng, knowledgeText: outcome.knowledgeText });
          return;
        }
        if (outcome.kind === 'viewer_only') {
          navigation.navigate(ROUTES.MAIN.AR_3D_VIEWER, {
            monumentId: site.name,
            objectLabel: outcome.asset.object_label,
            glbUrl: outcome.asset.glbUri,
            thumbnailUrl: outcome.asset.thumbnail_url,
            knowledgeText: outcome.knowledgeText,
          });
          return;
        }
        // 'placed' or 'pose_fallback' — both render in AR. The native AR view
        // resolves the actual anchor (curated placement OR pose fallback).
        setReconstructionReady({
          glbUrl: outcome.asset.glbUri,
          thumbnailUrl: outcome.asset.thumbnail_url,
          provider: 'catalog',
          cached: outcome.kind === 'placed' && outcome.strategy === 'curated',
          objectLabel: outcome.asset.object_label,
          quality: 'single_view',
          scanCount: 0,
        });
      } finally {
        setReconstructionLoading(false);
      }
    },
    [site, navigation],
  );

  const handleHelpAddThis = useCallback(
    async (suggestedLabel: string) => {
      const prompt = unknownPrompt;
      if (!prompt) return;
      setUnknownPrompt(null);
      try {
        const res = await submitUnknownScan({
          monument_id: site.name,
          image_base64: prompt.imageBase64,
          suggested_label: suggestedLabel,
          lat: prompt.lat,
          lng: prompt.lng,
        });
        if (!res.success) {
          setBypassError(
            'error' in res ? res.error.message : 'Failed to submit',
          );
          return;
        }
        // Friendly toast-equivalent: re-use bypassError for now (it's just a
        // banner). Will get its own non-error toast in a follow-up.
        setBypassError(
          res.data.merged
            ? 'Thanks — added to an existing report. We\'ll generate this soon.'
            : 'Thanks — submitted. We\'ll generate this soon.',
        );
      } catch (err) {
        setBypassError(
          err instanceof Error ? err.message : 'Failed to submit',
        );
      }
    },
    [unknownPrompt, site.name],
  );

  const handleOpenReconstruction = useCallback(() => {
    if (!reconstructionReady) return;
    const ctx = testCtxRef.current;
    navigation.navigate(ROUTES.MAIN.AR_COMPOSER, {
      monumentId: site.name,
      objectLabel: reconstructionReady.objectLabel,
      glbUrl: reconstructionReady.glbUrl,
      thumbnailUrl: reconstructionReady.thumbnailUrl,
      cached: reconstructionReady.cached,
      provider: reconstructionReady.provider,
      quality: reconstructionReady.quality,
      scanCount: reconstructionReady.scanCount,
      isTestMode: ctx !== null,
      testObjectDescription: ctx?.description,
    });
    testCtxRef.current = null;
  }, [navigation, reconstructionReady, site.name]);

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
      if (probe.success) setDescribeAnythingText(probe.text);
      else setDescribeAnythingText(`Probe failed: ${probe.error}`);
    } catch (err) {
      if (__DEV__) console.warn('[ARExperience.describeAnything]', err);
      setDescribeAnythingText('Probe threw — see Metro logs');
    } finally {
      setDescribeAnythingLoading(false);
    }
  }, [describeAnythingLoading]);

  // Auto-fire object detection once when the screen is ready, if devBypass is on.
  useEffect(() => {
    if (
      !devBypass ||
      autoDetectFiredRef.current ||
      !hasPermission ||
      !device
    ) {
      return;
    }
    autoDetectFiredRef.current = true;
    const t = setTimeout(() => {
      void runDevBypassDetection();
    }, 800);
    return () => clearTimeout(t);
  }, [devBypass, hasPermission, device, runDevBypassDetection]);

  useEffect(() => {
    return () => {
      reconstructionAbortedRef.current = true;
    };
  }, []);

  const handleExpandIdentification = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.SITE_DETAIL, { site });
  }, [navigation, site]);

  const handleUpgradePremium = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE);
  }, [navigation]);

  const handleHDScan = useCallback(async () => {
    if (hdScanLoading) {
      return;
    }
    if (!canShowMask) {
      navigation.navigate(ROUTES.MAIN.PURCHASE);
      return;
    }

    setHdScanLoading(true);
    setHdMasks([]);

    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) {
        throw new Error('Photo capture failed');
      }
      const token = await getValidAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const result = await performHDScan(photo.path, token);
      if (result.success && result.masks.length > 0) {
        setHdMasks(result.masks);
        trackUsageEvent('hd_scan', activeZone?.id);
      }
    } catch {
      // Silent — HD scan failures don't show errors to user
    } finally {
      setHdScanLoading(false);
    }
  }, [hdScanLoading, canShowMask, activeZone?.id, navigation]);

  const handleTimelineToggle = useCallback(() => {
    const toValue = timelineExpanded ? 100 : 380;
    timelineHeight.value = withSpring(toValue, {
      damping: 20,
      stiffness: 180,
    });
    setTimelineExpanded(prev => !prev);
  }, [timelineExpanded, timelineHeight]);

  const timelineAnimStyle = useAnimatedStyle(() => ({
    height: timelineHeight.value,
  }));

  // ── Permission fallback ──────────────────────────────────────────
  if (!hasPermission) {
    return (
      <GestureHandlerRootView className="flex-1">
        <SafeAreaView className="flex-1 bg-ink-deep items-center justify-center px-8">
          <Camera color="#D4860A" size={56} />
          <Text className="text-parchment text-xl text-center font-['MontserratAlternates-Bold'] mt-6 mb-2">
            Camera access needed
          </Text>
          <Text className="text-parchment-muted text-sm text-center font-['MontserratAlternates-Regular'] mb-8 leading-5">
            Allow camera access to explore {site.name} through augmented
            reality.
          </Text>
          <Pressable
            onPress={() => requestPermission().catch(() => {})}
            className="w-full bg-brand-gold rounded-xl py-3.5 items-center mb-3"
          >
            <Text className="text-ink text-base font-['MontserratAlternates-Bold']">
              Grant Camera Access
            </Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openSettings().catch(() => {})}
            className="w-full bg-surface-1 border border-white/10 rounded-xl py-3.5 items-center mb-3"
          >
            <Text className="text-parchment text-sm font-['MontserratAlternates-Medium']">
              Open Settings
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} className="mt-2">
            <Text className="text-parchment-dim text-sm font-['MontserratAlternates-Medium']">
              Back
            </Text>
          </Pressable>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // ── Main AR view ─────────────────────────────────────────────────
  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-ink-deep">
        {/* Camera layer */}
        {device && !cameraError && (
          <VisionCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused && !objectPicker}
            photo
            onError={err => {
              if (__DEV__) {
                console.warn('[ARExperience.camera]', err.code, err.message);
              }
              setCameraError(err.message);
            }}
          />
        )}

        {cameraError && (
          <View style={styles.cameraErrorOverlay}>
            <Text style={styles.cameraErrorTitle}>Camera unavailable</Text>
            <Text style={styles.cameraErrorBody}>{cameraError}</Text>
            <Text style={styles.cameraErrorHint}>
              Close other camera apps (Snapchat, Instagram, system Camera) then
              tap retry.
            </Text>
            <TouchableOpacity
              style={styles.cameraErrorRetry}
              onPress={() => setCameraError(null)}
            >
              <Text style={styles.cameraErrorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AR overlay — native ARCore view if available + has identification */}
        {arAvailable && geminiResult && (
          <EpocheyeARView
            style={StyleSheet.absoluteFill}
            identification={geminiResult}
            arEnabled
            onCardTapped={handleExpandIdentification}
            onARError={() => {}}
          />
        )}

        {/* HD Scan overlay */}
        {hdMasks.length > 0 && (
          <HDScanOverlay
            masks={hdMasks}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
          />
        )}

        {/* Subtle amber AR tint */}
        <View
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(212,134,10,0.06)' }}
          pointerEvents="none"
        />

        {/* Corner bracket markers */}
        {[
          { top: insets.top + 70, left: 24 },
          { top: insets.top + 70, right: 24 },
          { bottom: 420, left: 24 },
          { bottom: 420, right: 24 },
        ].map((pos, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                width: 22,
                height: 22,
                borderColor: 'rgba(212,134,10,0.6)',
                borderTopWidth: i < 2 ? 2 : 0,
                borderBottomWidth: i >= 2 ? 2 : 0,
                borderLeftWidth: i % 2 === 0 ? 2 : 0,
                borderRightWidth: i % 2 === 1 ? 2 : 0,
              },
              pos as any,
            ]}
          />
        ))}

        {/* "AR Active" / "AR coming soon" badge */}
        <SafeAreaView
          className="absolute top-0 left-0 right-0"
          pointerEvents="none"
        >
          <View className="items-center mt-16">
            <View className="flex-row items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5 border border-[rgba(212,134,10,0.3)]">
              {arAvailable ? (
                <>
                  <View className="w-2 h-2 rounded-full bg-status-success" />
                  <Text className="text-status-success text-[11px] font-['MontserratAlternates-SemiBold']">
                    AR Active
                  </Text>
                </>
              ) : (
                <>
                  <Sparkles color="#D4860A" size={11} />
                  <Text className="text-brand-amber text-[11px] font-['MontserratAlternates-Medium']">
                    Live AR launching soon
                  </Text>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>

        {/* Top controls */}
        <SafeAreaView className="absolute top-0 left-0 right-0">
          <View className="flex-row items-center justify-between px-5 py-4">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
            >
              <ArrowLeft color="#FFFFFF" size={22} />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              {__DEV__ && (
                <View
                  style={[
                    styles.devPill,
                    devBypass ? styles.devBypassOn : styles.devBypassOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.devPillText,
                      devBypass && styles.devBypassOnText,
                    ]}
                  >
                    BYPASS: {devBypass ? 'ON' : 'OFF'}
                  </Text>
                </View>
              )}
              {__DEV__ && (
                <TouchableOpacity
                  onPress={handleDescribeAnything}
                  disabled={describeAnythingLoading}
                  style={[
                    styles.devPill,
                    styles.devProbePill,
                    describeAnythingLoading && styles.devPillLoading,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Describe anything (dev)"
                >
                  <Text style={styles.devPillText}>
                    {describeAnythingLoading ? 'PROBING…' : 'DEV: DESCRIBE'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setShowInfo(true)}
                className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
              >
                <HelpCircle color="#FFFFFF" size={22} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {__DEV__ && describeAnythingText && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[styles.devProbeBanner, { top: insets.top + 60 }]}
          >
            <Text style={styles.devProbeBannerLabel}>DEV PROBE</Text>
            <Text style={styles.devProbeBannerText}>{describeAnythingText}</Text>
            <TouchableOpacity
              onPress={() => setDescribeAnythingText(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss probe result"
              hitSlop={8}
            >
              <X color="#F5F0E8" size={14} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Monument name overlay */}
        <View className="absolute left-5 right-5" style={{ top: insets.top + 80 }}>
          <View className="bg-black/60 rounded-2xl p-4">
            <Text className="text-parchment text-xl font-['MontserratAlternates-Bold']">
              {site.name}
            </Text>
            <Text className="text-brand-amber text-sm font-['MontserratAlternates-SemiBold'] mt-1">
              Heritage Monument
            </Text>
          </View>
        </View>

        {/* Identification Card — shown when Gemini has a result, is loading, or has error */}
        {(geminiResult || geminiLoading || geminiError) && !arAvailable && (
          <View className="absolute left-5 right-5" style={{ top: insets.top + 170 }}>
            <IdentificationCard
              identification={geminiResult}
              isLoading={geminiLoading}
              error={geminiError}
              isPremium={canShowDetails}
              isOffline={isOfflineResult}
              onDismiss={dismissIdentification}
              onExpand={handleExpandIdentification}
              onUpgrade={handleUpgradePremium}
            />
          </View>
        )}

        {/* Object Identification action button */}
        <View className="absolute left-5 right-5 bottom-[210px]">
          <TouchableOpacity
            onPress={handleIdentify}
            activeOpacity={0.88}
            className="bg-[#12121A]/90 rounded-2xl p-4 border border-[#272730] flex-row items-center gap-3"
          >
            <View className="w-10 h-10 rounded-full bg-brand-amber/15 items-center justify-center">
              <ScanEye color="#D4860A" size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-parchment text-sm font-['MontserratAlternates-SemiBold']">
                Identify Object
              </Text>
              <Text
                className="text-[#8D8D92] text-xs font-['MontserratAlternates-Regular'] mt-0.5"
                numberOfLines={1}
              >
                {geminiLoading
                  ? 'Identifying...'
                  : `Point camera at an artifact (${remainingCalls} left today)`}
              </Text>
            </View>
            {canShowMask && (
              <TouchableOpacity
                onPress={handleHDScan}
                className="bg-brand-gold/15 border border-brand-gold/30 rounded-full px-2.5 py-1"
              >
                <Text className="text-brand-gold text-[10px] font-['MontserratAlternates-SemiBold']">
                  {hdScanLoading ? '...' : 'HD Scan'}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* Dev-bypass: reconstruction CTA */}
        {(reconstructionReady || reconstructionLoading || reconstructionPending || bypassError) && (
          <View style={[styles.reconstructionBar, { bottom: 420 }]}>
            {reconstructionPending ? (
              <Text style={styles.reconstructionText}>
                {reconstructionPending.phase === 'cold_start'
                  ? `Starting 3D engine… ~${Math.max(0, Math.round(reconstructionPending.etaSeconds))}s`
                  : `Reconstructing… ~${Math.max(0, Math.round(reconstructionPending.etaSeconds))}s`}
              </Text>
            ) : reconstructionLoading ? (
              <Text style={styles.reconstructionText}>Building 3D model…</Text>
            ) : null}
            {reconstructionReady && !reconstructionLoading && (
              <TouchableOpacity
                style={styles.reconstructionCta}
                onPress={handleOpenReconstruction}
              >
                <Text style={styles.reconstructionCtaText}>View in 3D</Text>
              </TouchableOpacity>
            )}
            {bypassError && !reconstructionLoading && (
              <Text style={styles.reconstructionText}>{bypassError}</Text>
            )}
          </View>
        )}

        {/* Dev-bypass: object picker overlay */}
        {objectPicker && (
          <ObjectPickerOverlay
            imageBase64={objectPicker.imageBase64}
            objects={objectPicker.objects}
            onCancel={() => setObjectPicker(null)}
            onConfirm={handleObjectPickerConfirm}
          />
        )}

        {bypassLoading && !objectPicker && (
          <View style={[styles.bypassLoadingPill, { top: insets.top + 60 }]}>
            <Text style={styles.bypassLoadingText}>Detecting objects…</Text>
          </View>
        )}

        {/* "Help us add this" prompt for match='unknown' results. */}
        {unknownPrompt && (
          <View style={styles.helpAddOverlay}>
            <View style={styles.helpAddCard}>
              <Text style={styles.helpAddTitle}>Not in our catalog yet</Text>
              <Text style={styles.helpAddBody}>
                We don't have this object modelled. Help us add it — type a
                short label so our team can curate it.
              </Text>
              <View style={styles.helpAddRow}>
                <TouchableOpacity
                  style={styles.helpAddSecondary}
                  onPress={() => setUnknownPrompt(null)}
                >
                  <Text style={styles.helpAddSecondaryText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.helpAddPrimary}
                  onPress={() => handleHelpAddThis('this object')}
                >
                  <Text style={styles.helpAddPrimaryText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Timeline Drawer */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(12, 12, 18, 0.97)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: '#272730',
              overflow: 'hidden',
            },
            timelineAnimStyle,
          ]}
        >
          {/* Drag handle + title */}
          <TouchableOpacity
            onPress={handleTimelineToggle}
            className="items-center pt-3 pb-2"
            accessibilityRole="button"
            accessibilityLabel={
              timelineExpanded ? 'Collapse timeline' : 'Expand timeline'
            }
          >
            <View className="w-9 h-1 rounded-full bg-[#3A3A44] mb-3" />
            <View className="flex-row items-center justify-between w-full px-5">
              <View className="flex-row items-center gap-2">
                <Clock color="#D4860A" size={16} />
                <Text className="text-parchment text-base font-['MontserratAlternates-SemiBold']">
                  Historical Insights
                </Text>
              </View>
              {timelineExpanded ? (
                <ChevronDown color="#6B6357" size={18} />
              ) : (
                <ChevronUp color="#6B6357" size={18} />
              )}
            </View>
          </TouchableOpacity>

          {/* Timeline content */}
          {timelineExpanded && (
            <Animated.ScrollView
              entering={FadeIn.duration(300)}
              className="flex-1 px-5 pb-5"
              showsVerticalScrollIndicator={false}
            >
              {timelineLoading ? (
                <View className="py-4 items-center">
                  <Text className="text-parchment-dim text-sm font-['MontserratAlternates-Regular']">
                    Loading insights...
                  </Text>
                </View>
              ) : timelineFacts.length > 0 ? (
                timelineFacts.map((fact, index) => (
                  <Animated.View
                    key={fact.id}
                    entering={FadeInDown.delay(index * 80).duration(300)}
                    className="flex-row items-start mb-4"
                  >
                    {/* Vertical connector */}
                    <View className="items-center mr-3" style={{ width: 20 }}>
                      <View className="w-4 h-4 rounded-full bg-brand-amber items-center justify-center">
                        <View className="w-2 h-2 rounded-full bg-ink" />
                      </View>
                      {index < timelineFacts.length - 1 && (
                        <View
                          className="w-0.5 flex-1 bg-[#272730] mt-1"
                          style={{ minHeight: 24 }}
                        />
                      )}
                    </View>
                    <View className="flex-1 pb-2">
                      <Text className="text-parchment text-sm font-['MontserratAlternates-SemiBold']">
                        {fact.headline}
                      </Text>
                      <Text className="text-[#8D8D92] text-xs font-['MontserratAlternates-Regular'] mt-1 leading-4">
                        {fact.summary}
                      </Text>
                    </View>
                  </Animated.View>
                ))
              ) : (
                <View className="py-4 items-center">
                  <Text className="text-parchment-dim text-sm font-['MontserratAlternates-Regular']">
                    No insights available for this monument yet
                  </Text>
                </View>
              )}
            </Animated.ScrollView>
          )}

          {/* Exit button */}
          {!timelineExpanded && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mx-5 mt-1 bg-[#1F1F2A] rounded-2xl py-3 items-center justify-center border border-[#272730]"
            >
              <Text className="text-white text-sm font-['MontserratAlternates-SemiBold']">
                Exit AR Experience
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Info Modal */}
        {showInfo && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="absolute inset-0 bg-black/70 items-center justify-center px-8"
          >
            <View className="bg-[#12121A] rounded-3xl p-6 w-full border border-[#272730]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-xl font-['MontserratAlternates-Bold']">
                  AR Experience Help
                </Text>
                <TouchableOpacity onPress={() => setShowInfo(false)}>
                  <X color="#8D8D92" size={24} />
                </TouchableOpacity>
              </View>
              <Text className="text-[#B4B4BA] text-base font-['MontserratAlternates-Regular'] leading-6">
                {'\u2022'} Tap "Identify Object" to scan artifacts with AI
                {'\n'}{'\u2022'} Swipe up the drawer for historical insights
                {'\n'}{'\u2022'} Premium users can use HD Scan for detailed segmentation
                {'\n'}{'\u2022'} {arAvailable
                  ? 'AR overlays are active — move your phone to explore'
                  : 'Full AR overlays coming in a future update'}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  devPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  devProbePill: {
    backgroundColor: 'rgba(232, 160, 32, 0.18)',
    borderColor: 'rgba(232, 160, 32, 0.6)',
  },
  devPillLoading: {
    opacity: 0.6,
  },
  devPillText: {
    color: '#E8A020',
    fontSize: 10,
    letterSpacing: 1.2,
    fontFamily: 'MontserratAlternates-Bold',
  },
  devBypassOn: {
    backgroundColor: 'rgba(72, 187, 120, 0.18)',
    borderColor: 'rgba(72, 187, 120, 0.7)',
  },
  devBypassOff: {
    backgroundColor: 'rgba(120, 120, 120, 0.15)',
    borderColor: 'rgba(180, 180, 180, 0.4)',
  },
  devBypassOnText: {
    color: '#48BB78',
  },
  devProbeBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,10,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.4)',
  },
  devProbeBannerLabel: {
    color: '#E8A020',
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: 'MontserratAlternates-Bold',
  },
  devProbeBannerText: {
    flex: 1,
    color: '#F5F0E8',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-Regular',
    lineHeight: 16,
  },
  reconstructionBar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 6,
  },
  reconstructionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-Medium',
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
    fontFamily: 'MontserratAlternates-Bold',
  },
  bypassLoadingPill: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(72, 187, 120, 0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 5,
  },
  bypassLoadingText: {
    color: '#48BB78',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  helpAddOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 30,
  },
  helpAddCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#101015',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  helpAddTitle: {
    color: '#F5F0E8',
    fontSize: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
    marginBottom: 8,
  },
  helpAddBody: {
    color: 'rgba(245,240,232,0.7)',
    fontSize: 13,
    fontFamily: 'MontserratAlternates-Regular',
    lineHeight: 19,
    marginBottom: 16,
  },
  helpAddRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  helpAddSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  helpAddSecondaryText: {
    color: 'rgba(245,240,232,0.8)',
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 12,
  },
  helpAddPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#D4860A',
  },
  helpAddPrimaryText: {
    color: '#0A0A0A',
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 12,
  },
  cameraErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 20,
  },
  cameraErrorTitle: {
    color: '#F5F0E8',
    fontSize: 18,
    fontFamily: 'MontserratAlternates-Bold',
    marginBottom: 8,
  },
  cameraErrorBody: {
    color: '#E8A020',
    fontSize: 13,
    fontFamily: 'MontserratAlternates-Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
  cameraErrorHint: {
    color: '#8D8D92',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  cameraErrorRetry: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: '#E8A020',
    borderRadius: 999,
  },
  cameraErrorRetryText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Bold',
  },
});

export default ARExperienceScreen;
