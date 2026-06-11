/**
 * DetectArScreen — detector-driven world-anchored AR + a dev model-picker.
 *
 * Modes (chosen by route param + native availability):
 *
 *  • PRODUCTION (no `devPicker`): point at an artifact → "Detect" captures an
 *    ARCore frame → Roboflow → class_id → grounded card (truth) or labelled AI
 *    guess (fallback). On a grounded hit the matching model is loaded from the
 *    CDN and world-anchored at the object; the data card shows alongside.
 *
 *  • DEV PICKER (`devPicker: true`, Settings → DEV): home-testable harness —
 *    pick one of the 5 museum models → it auto-places ~1.2 m in front of you,
 *    world-locked, with its grounded data card + scan animation. Bypasses the
 *    detector (you can't point at a real museum artifact at home) so it just
 *    verifies that models launch and the animations fire.
 *
 *  • NON-AR fallback: when ARCore is unavailable, the data card is still shown
 *    (no 3D model — the JS three.js viewer can't decode the compressed GLBs).
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Camera,
  RefreshCcw,
  RotateCw,
  ScanSearch,
  Settings as SettingsIcon,
  X,
} from 'lucide-react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import EpocheyeDetectARView, {
  isDetectARAvailable,
  type EpocheyeDetectARHandle,
} from '../../native/EpocheyeDetectARView';
import {useARCore} from '../../shared/hooks/useARCore';
import {prepareImageForGemini} from '../../services/geminiVisionService';
import {PermissionService} from '../../shared/services/permission.service';
import {resolveModelGlb} from '../../services/glbSource';
import {recognize} from '../../services/recognizeService';
// fetchObjectCard is the grounded data-card lookup (GET /vision/object/{class_id});
// it is NOT the Roboflow detector. Roboflow (roboflowDetectionService /
// resolveDetection) is retired off the live recognition path — kept dormant in the
// repo behind ROBOFLOW_ENABLED for a possible future cheap pre-filter.
import {fetchObjectCard, type ObjectCard} from '../../services/detectorResolver';
import {useVenueGate} from '../../shared/hooks/useVenueGate';
import PulsingRing from '../Lens/components/PulsingRing';
import GroundedObjectCard from './components/GroundedObjectCard';
import AiGuessCard from './components/AiGuessCard';
import AnalyzingOverlay from './components/AnalyzingOverlay';
import {ROUTES} from '../../core/constants';
import {COLORS} from '../../core/constants/theme';
import type {MainStackParamList} from '../../core/types/navigation.types';

// Primary accent for the scan screen — the theme's sky token (was a stale amber
// hex). Named AMBER for historical reasons; it now drives the current palette.
const AMBER = COLORS.sky;
const YAW_STEP_DEG = 15;

/** The only venue with a trained detector today. Overridable via route param. */
const DEFAULT_DETECTOR_VENUE = 'indian-museum';

/** The 5 detector-class models, for the dev picker (exact seeded class_ids). */
const DEV_MODELS: {classId: string; name: string}[] = [
  {classId: 'muchalinda_buddha', name: 'Muchalinda Buddha'},
  {classId: 'naga_canopy_seated_deity', name: 'Nagaraja'},
  {classId: 'khadiravani_tara', name: 'Khadiravani Tara'},
  {classId: 'seated_four_arm_goddess', name: 'Four-Armed Goddess'},
  {classId: 'seated_buddha_oval_halo', name: 'Earth-Touching Buddha'},
];

type RouteParam = {
  key: string;
  name: 'DetectAr';
  params: MainStackParamList['DetectAr'];
};

type ARStatus = 'initializing' | 'searching' | 'ready' | 'placed' | 'error';

/**
 * Resolution state for the production detector path: a grounded card wins
 * unconditionally; the AI-guess fallback is a separate, visually-distinct state
 * reached only when nothing grounded resolves. They never co-exist.
 */
type ResolvedState =
  | {kind: 'idle'}
  | {kind: 'grounded'; card: ObjectCard; minimal: boolean}
  | {kind: 'ai'; label: string | null; text: string; streaming: boolean};

/** What runResolution decided, so the caller can place the model / route the user. */
type ResolutionOutcome =
  | {kind: 'grounded' | 'minimal'; classId: string}
  | {kind: 'ai'}
  | {kind: 'paywall'; paywall: {siteId: string; used: number; limit: number}}
  | {kind: 'error'};

/**
 * Shared resolution engine. The PRIMARY (and only) recognizer is the server-side
 * three-layer agent behind POST /api/v1/recognize. There is NO universal
 * museum-mode fallback — recognition only happens inside a venue (the screen is
 * venue-gated), and the two-gate rule is enforced server-side:
 *
 *   - match 'grounded'          → fetch the grounded data card (GET /vision/object)
 *                                 and place that class's model. A grounded card wins.
 *   - match 'ai_interpretation' → a clearly-labelled, non-streaming "AI" card.
 *   - match 'paywall'           → free scans spent at this venue → route to purchase.
 *
 * Grounded and AI content never co-exist. Returns the outcome so the caller can
 * place the model, route to the paywall, or show a retry message.
 */
function useDetectionResolver(venueSlug: string) {
  const [resolved, setResolved] = useState<ResolvedState>({kind: 'idle'});
  const abortRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setResolved({kind: 'idle'});
  }, []);

  useEffect(() => () => abortRef.current?.(), []);

  const runResolution = useCallback(
    async (frameBase64: string): Promise<ResolutionOutcome> => {
      let result;
      try {
        result = await recognize({imageBase64: frameBase64, venueId: venueSlug});
      } catch {
        return {kind: 'error'};
      }

      // Per-site free scans spent → caller routes to the Explorer-Pass purchase.
      if (result.match === 'paywall') {
        return {
          kind: 'paywall',
          paywall: result.paywall ?? {siteId: venueSlug, used: 0, limit: 0},
        };
      }

      // GROUNDED → reuse the grounded data-card lookup so GroundedObjectCard and the
      // native cardData contract stay unchanged; class_id drives GLB placement.
      if (result.match === 'grounded' && result.class_id) {
        try {
          const card = await fetchObjectCard(result.class_id);
          if (card) {
            const minimal = !card.narrative || card.narrative.trim().length === 0;
            setResolved({kind: 'grounded', card, minimal});
            return {kind: minimal ? 'minimal' : 'grounded', classId: result.class_id};
          }
        } catch {
          // fall through to the AI card / error
        }
      }

      // AI interpretation (the in-venue two-gate fallback) → labelled card, no stream.
      if (result.match === 'ai_interpretation' && result.card) {
        setResolved({
          kind: 'ai',
          label: result.card.title || null,
          text: result.card.body || '',
          streaming: false,
        });
        return {kind: 'ai'};
      }

      // out_of_venue / unexpected — the venue gate should prevent this.
      return {kind: 'error'};
    },
    [venueSlug],
  );

  return {resolved, runResolution, reset};
}

const DetectArScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute() as unknown as RouteParam;
  const venueSlug = route.params?.venueSlug ?? DEFAULT_DETECTOR_VENUE;
  const devPicker = route.params?.devPicker === true;

  const {hasPermission, requestPermission} = useCameraPermission();
  const {arAvailable, arChecked} = useARCore();
  const {inVenue} = useVenueGate();
  const permissionRequestedRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (hasPermission || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    void requestPermission().then(granted => {
      if (!granted) setPermissionDenied(true);
    });
  }, [hasPermission, requestPermission]);

  // Venue lock: the live scan/AR experience only runs inside a curated venue.
  // Away from one, redirect to the "go to your nearest venue" screen. The dev
  // picker is a home-testing harness and intentionally bypasses the gate.
  useEffect(() => {
    if (!devPicker && !inVenue) {
      navigation.replace(ROUTES.MAIN.GO_TO_VENUE);
    }
  }, [devPicker, inVenue, navigation]);

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);

  if (!devPicker && !inVenue) {
    return <View style={styles.root} />; // redirecting to GoToVenue
  }

  // Native AR when the module is registered AND ARCore supports the device (or
  // the support check hasn't completed yet — optimistic until proven false).
  const useNativeAR = isDetectARAvailable && (!arChecked || arAvailable);

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Camera size={40} color={AMBER} />
          <Text style={styles.fallbackHeading}>Allow Camera to continue</Text>
          <Text style={styles.fallbackBody}>
            The detector and AR both need the camera. Footage stays on the device.
          </Text>
          {permissionDenied ? (
            <Pressable
              onPress={() => void PermissionService.openAppSettings()}
              style={styles.fallbackButton}>
              <SettingsIcon size={14} color="#1A0F00" />
              <Text style={styles.fallbackButtonText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void requestPermission()}
              style={styles.fallbackButton}>
              <Text style={styles.fallbackButtonText}>Allow Camera</Text>
            </Pressable>
          )}
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.fallbackDismiss}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (devPicker) {
    // Mount the AR view whenever the native module is present (let ARCore itself
    // report any real unavailability via onError) — so an over-cautious
    // availability check can't leave the dev test on a black non-AR card.
    return (
      <DetectARDevPicker
        arAvailable={isDetectARAvailable}
        onClose={handleClose}
      />
    );
  }
  if (useNativeAR) {
    return <DetectARNative venueSlug={venueSlug} onClose={handleClose} />;
  }
  return <DetectAR2D venueSlug={venueSlug} onClose={handleClose} />;
};

// ============================================================
// DEV model-picker: pick a model → auto-place in front + card
// ============================================================

const DetectARDevPicker: React.FC<{
  arAvailable: boolean;
  onClose: () => void;
}> = ({arAvailable, onClose}) => {
  const arRef = useRef<EpocheyeDetectARHandle>(null);
  const [status, setStatus] = useState<ARStatus>('initializing');
  const [tracking, setTracking] = useState(false);
  const [glbUri, setGlbUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [card, setCard] = useState<ObjectCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePick = useCallback(
    async (classId: string) => {
      setSelected(classId);
      setLoading(true);
      setErrorMessage(null);
      setCard(null);
      arRef.current?.clearAnchor();
      try {
        // Resolve the FULL model (CDN→cache, no low placeholder) + the grounded
        // card (best-effort) in parallel.
        const [uri, fetchedCard] = await Promise.all([
          resolveModelGlb(classId),
          fetchObjectCard(classId).catch(() => null),
        ]);
        setCard(fetchedCard);
        if (!uri) {
          setErrorMessage('Model not on the CDN — is GLB_BASE_URL set?');
          return;
        }
        setGlbUri(uri);
        // Native defers the actual placement until the model + TRACKING are ready.
        if (arAvailable) arRef.current?.placeInFront();
      } catch {
        setErrorMessage('Couldn’t load that model — try again.');
      } finally {
        setLoading(false);
      }
    },
    [arAvailable],
  );

  const handleReady = useCallback(() => {
    setStatus(prev => (prev === 'placed' ? prev : 'searching'));
  }, []);
  const handleTrackingState = useCallback((state: string) => {
    setTracking(state === 'TRACKING');
  }, []);
  const handlePlaneDetected = useCallback(() => {
    setStatus(prev => (prev === 'placed' ? prev : 'ready'));
  }, []);
  const handleAnchorPlaced = useCallback(() => setStatus('placed'), []);
  const handleError = useCallback((err: string) => setErrorMessage(err), []);
  const handleYaw = useCallback(() => arRef.current?.nudgeYaw(YAW_STEP_DEG), []);

  const hint = !arAvailable
    ? 'Native AR module not in this build — do a full "npm run android" rebuild.'
    : !tracking
      ? 'Move your phone slowly to scan the area'
      : selected
        ? 'Model placed ~1.2 m ahead · ⟳ rotate · pick another below'
        : 'Pick a model below — it appears in front of you';

  return (
    <View style={styles.root}>
      {arAvailable ? (
        <EpocheyeDetectARView
          ref={arRef}
          style={StyleSheet.absoluteFill}
          glbUri={glbUri ?? undefined}
          cardData={card ? JSON.stringify(card) : undefined}
          onReady={handleReady}
          onTrackingState={handleTrackingState}
          onPlaneDetected={handlePlaneDetected}
          onAnchorPlaced={handleAnchorPlaced}
          onError={handleError}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noArBackdrop]} />
      )}

      {loading && <PulsingRing matched={false} />}

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>DEV · AR Model Test</Text>
            <Text style={styles.subtitle}>
              {arAvailable ? (tracking ? 'tracking' : 'scanning') : 'no AR'} · pick a model
            </Text>
          </View>
          {status === 'placed' && arAvailable ? (
            <Pressable onPress={handleYaw} hitSlop={12} style={styles.iconButton}>
              <RotateCw size={16} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        {/* The grounded data shows on the world-anchored AR placard above the
            model — the on-screen card is intentionally omitted in the dev test. */}
        <View
          style={[styles.messageBubble, status === 'error' && styles.bubbleError]}
          pointerEvents="none">
          <Text style={styles.messageText}>{errorMessage ?? hint}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pickerBar}>
          {DEV_MODELS.map(m => (
            <Pressable
              key={m.classId}
              onPress={() => void handlePick(m.classId)}
              disabled={loading}
              style={[
                styles.pickerChip,
                selected === m.classId && styles.pickerChipActive,
              ]}>
              <Text
                style={[
                  styles.pickerChipText,
                  selected === m.classId && styles.pickerChipTextActive,
                ]}>
                {m.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// ============================================================
// PRODUCTION native AR: detect → grounded card → world-anchored model
// ============================================================

const DetectARNative: React.FC<{
  venueSlug: string;
  onClose: () => void;
}> = ({venueSlug, onClose}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const arRef = useRef<EpocheyeDetectARHandle>(null);
  const [status, setStatus] = useState<ARStatus>('initializing');
  const [tracking, setTracking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  // The model to render — set from the DETECTED class (not a hardcoded marquee).
  const [glbUri, setGlbUri] = useState<string | null>(null);
  const {resolved, runResolution, reset} = useDetectionResolver(venueSlug);

  const trackingRef = useRef(false);
  useEffect(() => {
    trackingRef.current = tracking;
  }, [tracking]);

  const handleReady = useCallback(() => {
    setStatus(prev => (prev === 'placed' ? prev : 'searching'));
  }, []);

  const handleDetect = useCallback(() => {
    if (detecting) return;
    if (!trackingRef.current) {
      setErrorMessage('Move your phone slowly to scan first');
      return;
    }
    setDetecting(true);
    setErrorMessage('Scanning…');
    arRef.current?.captureFrame();
  }, [detecting]);

  const handleFrameCaptured = useCallback(
    async (uri: string) => {
      try {
        const base64 = await prepareImageForGemini(uri);
        // Strict precedence (enforced server-side by the two-gate agent): a grounded
        // class wins → load THAT class's model and anchor it; an AI card is shown by
        // the hook; a spent allowance routes to purchase.
        const resolution = await runResolution(base64);
        if (resolution.kind === 'grounded' || resolution.kind === 'minimal') {
          const modelUri = await resolveModelGlb(resolution.classId);
          if (modelUri) setGlbUri(modelUri);
          // The recognizer no longer returns a detector bounding box. The user aimed
          // at the artifact, so anchor near the screen centre; native defers
          // placement until the model + TRACKING are both ready. (Precise hit-test
          // placement / AR placard UI is a later step.)
          arRef.current?.placeFromDetection(0.5, 0.85);
          setErrorMessage(null);
        } else if (resolution.kind === 'paywall') {
          navigation.navigate(ROUTES.MAIN.PURCHASE, {preSelectedPlaceId: venueSlug});
        } else if (resolution.kind === 'error') {
          setErrorMessage('Couldn’t reach the lens — try again');
        } else {
          setErrorMessage(null); // 'ai' — labelled card set by the hook
        }
      } catch {
        setErrorMessage('Detection failed — try again');
      } finally {
        setDetecting(false);
      }
    },
    [runResolution, navigation, venueSlug],
  );

  const handleTrackingState = useCallback((state: string) => {
    setTracking(state === 'TRACKING');
  }, []);
  const handlePlaneDetected = useCallback(() => {
    setStatus(prev => (prev === 'placed' ? prev : 'ready'));
  }, []);
  const handleAnchorPlaced = useCallback(() => {
    setStatus('placed');
    setErrorMessage(null);
  }, []);
  const handleError = useCallback((err: string) => {
    setDetecting(false);
    setErrorMessage(err);
  }, []);

  const handleReset = useCallback(() => {
    arRef.current?.clearAnchor();
    setGlbUri(null);
    reset();
    setStatus(prev => (prev === 'placed' ? 'ready' : prev));
  }, [reset]);

  const handleYaw = useCallback(() => arRef.current?.nudgeYaw(YAW_STEP_DEG), []);

  const hint = !tracking
    ? 'Move your phone slowly to scan the area'
    : status === 'placed'
      ? 'Walk around — it stays locked · ⟳ rotate · Detect again to re-scan'
      : 'Point at an artifact and tap Detect';

  return (
    <View style={styles.root}>
      <EpocheyeDetectARView
        ref={arRef}
        style={StyleSheet.absoluteFill}
        glbUri={glbUri ?? undefined}
        cardData={
          resolved.kind === 'grounded' ? JSON.stringify(resolved.card) : undefined
        }
        onReady={handleReady}
        onTrackingState={handleTrackingState}
        onPlaneDetected={handlePlaneDetected}
        onAnchorPlaced={handleAnchorPlaced}
        onError={handleError}
        onFrameCaptured={handleFrameCaptured}
      />

      <AnalyzingOverlay visible={detecting} />

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Scan artifact</Text>
            <Text style={styles.subtitle}>
              {tracking ? 'tracking' : 'scanning'} · world-anchored
            </Text>
          </View>
          <Pressable
            onPress={handleReset}
            hitSlop={12}
            style={[styles.iconButton, status !== 'placed' && styles.iconButtonDisabled]}>
            <RefreshCcw
              size={16}
              color={status === 'placed' ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        {resolved.kind === 'grounded' && (
          <View style={styles.cardWrap}>
            <GroundedObjectCard card={resolved.card} minimal={resolved.minimal} />
          </View>
        )}
        {resolved.kind === 'ai' && (
          <View style={styles.cardWrap}>
            <AiGuessCard
              label={resolved.label}
              text={resolved.text}
              streaming={resolved.streaming}
            />
          </View>
        )}

        <View
          style={[styles.messageBubble, status === 'error' && styles.bubbleError]}
          pointerEvents="none">
          <Text style={styles.messageText}>{errorMessage ?? hint}</Text>
        </View>

        <View style={styles.buttonRow} pointerEvents="box-none">
          <Pressable
            onPress={handleDetect}
            disabled={detecting}
            style={[styles.detectButton, detecting && styles.detectButtonBusy]}>
            {detecting ? (
              <ActivityIndicator color="#1A0F00" />
            ) : (
              <>
                <ScanSearch size={18} color="#1A0F00" />
                <Text style={styles.detectButtonText}>Detect</Text>
              </>
            )}
          </Pressable>
          {status === 'placed' && (
            <Pressable onPress={handleYaw} style={styles.roundButton}>
              <RotateCw size={20} color="#1A0F00" />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

// ============================================================
// NON-AR fallback: scan → data card only (no 3D model)
// ============================================================

const DetectAR2D: React.FC<{venueSlug: string; onClose: () => void}> = ({
  venueSlug,
  onClose,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const cameraRef = useRef<VisionCamera | null>(null);
  const device = useCameraDevice('back');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const {resolved, runResolution} = useDetectionResolver(venueSlug);

  const handleDetect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo?.path) {
        setMessage('Could not capture a frame');
        return;
      }
      const base64 = await prepareImageForGemini(photo.path);
      // Same precedence as AR; no 3D model here (this device can't do AR, and the
      // compressed CDN GLBs aren't decodable by the JS viewer) — the card is the
      // surface.
      const resolution = await runResolution(base64);
      if (resolution.kind === 'paywall') {
        navigation.navigate(ROUTES.MAIN.PURCHASE, {preSelectedPlaceId: venueSlug});
      } else if (resolution.kind === 'error') {
        setMessage('Couldn’t reach the lens — try again');
      } else {
        setMessage(null);
      }
    } catch {
      setMessage('Detection failed — try again');
    } finally {
      setBusy(false);
    }
  }, [busy, runResolution, navigation, venueSlug]);

  if (!device) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Text style={styles.fallbackHeading}>No camera available</Text>
          <Pressable onPress={onClose} style={styles.fallbackButton}>
            <Text style={styles.fallbackButtonText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <VisionCamera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        photo
      />

      <AnalyzingOverlay visible={busy} />

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Scan artifact</Text>
            <Text style={styles.subtitle}>identify · no AR on this device</Text>
          </View>
          <View style={styles.iconButton} />
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.arNotice} pointerEvents="none">
          <Text style={styles.arNoticeText}>
            AR isn’t available on this device — showing the info card instead.
          </Text>
        </View>

        {resolved.kind === 'grounded' && (
          <View style={styles.cardWrap}>
            <GroundedObjectCard card={resolved.card} minimal={resolved.minimal} />
          </View>
        )}
        {resolved.kind === 'ai' && (
          <View style={styles.cardWrap}>
            <AiGuessCard
              label={resolved.label}
              text={resolved.text}
              streaming={resolved.streaming}
            />
          </View>
        )}

        {message && (
          <View style={styles.messageBubble} pointerEvents="none">
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        <Pressable
          onPress={handleDetect}
          disabled={busy}
          style={[styles.detectButton, busy && styles.detectButtonBusy]}>
          {busy ? (
            <ActivityIndicator color="#1A0F00" />
          ) : (
            <>
              <ScanSearch size={18} color="#1A0F00" />
              <Text style={styles.detectButtonText}>Detect</Text>
            </>
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000000'},
  noArBackdrop: {backgroundColor: '#0A0A0A'},
  topOverlay: {position: 'absolute', top: 0, left: 0, right: 0},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  iconButtonDisabled: {backgroundColor: 'rgba(0,0,0,0.3)'},
  titleBlock: {flex: 1, alignItems: 'center'},
  title: {
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.6,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  cardWrap: {width: '100%', alignSelf: 'stretch'},
  arNotice: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(138,160,180,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(138,160,180,0.4)',
  },
  arNoticeText: {
    fontFamily: 'InstrumentSans-Medium',
    fontSize: 12,
    color: '#C7D4DF',
    textAlign: 'center',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '90%',
  },
  bubbleError: {borderColor: 'rgba(239,68,68,0.55)'},
  messageText: {
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pickerBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  pickerChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.45)',
  },
  pickerChipActive: {backgroundColor: AMBER, borderColor: AMBER},
  pickerChipText: {
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 13,
    color: AMBER,
  },
  pickerChipTextActive: {color: '#1A0F00'},
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 160,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: AMBER,
  },
  detectButtonBusy: {opacity: 0.7},
  detectButtonText: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 15,
    color: '#1A0F00',
  },
  roundButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AMBER,
  },
  fallbackBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 4,
  },
  fallbackHeading: {
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  fallbackBody: {
    fontFamily: 'MontserratAlternates-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  fallbackButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fallbackButtonText: {
    fontFamily: 'MontserratAlternates-Bold',
    fontSize: 13,
    color: '#1A0F00',
  },
  fallbackDismiss: {
    marginTop: 18,
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});

export default DetectArScreen;
