/**
 * DetectArScreen — detector-driven world-anchored AR scan.
 *
 * Modes (chosen by route param + native availability):
 *
 *  • PRODUCTION (no `devPicker`): venue-gated. Point at an artifact → "Detect"
 *    captures an ARCore frame → the recognition agent → grounded card (truth) or
 *    labelled AI guess (fallback). On a grounded hit the matching model is loaded
 *    from the CDN and world-anchored at the object; the data card shows alongside.
 *
 *  • DEV "scan anything" (`devPicker: true`, the __DEV__-only Settings entry):
 *    the SAME live scan UX + animation as production, but the agent runs
 *    ungrounded (any object, no venue, no paywall — server only honors this for
 *    admins / RECOGNIZE_DEV_UNGROUNDED) so it can be tested at home. The venue
 *    gate is bypassed; production stays geofenced.
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
import {streamMuseumNarration} from '../../services/museumModeService';
// fetchObjectCard is the grounded data-card lookup (GET /vision/object/{class_id});
// it is NOT the Roboflow detector. Roboflow (roboflowDetectionService /
// resolveDetection) is retired off the live recognition path — kept dormant in the
// repo behind ROBOFLOW_ENABLED for a possible future cheap pre-filter.
import {fetchObjectCard, type ObjectCard} from '../../services/detectorResolver';
import {useVenueGate} from '../../shared/hooks/useVenueGate';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroundedObjectCard from './components/GroundedObjectCard';
import AiGuessCard from './components/AiGuessCard';
import AnalyzingOverlay from './components/AnalyzingOverlay';
import ShareExperienceModal from '../../components/ShareExperienceModal';
import {ROUTES} from '../../core/constants';
import {COLORS} from '../../core/constants/theme';
import type {MainStackParamList} from '../../core/types/navigation.types';

// Primary accent for the scan screen — the theme's sky token (was a stale amber
// hex). Named AMBER for historical reasons; it now drives the current palette.
const AMBER = COLORS.sky;
const YAW_STEP_DEG = 15;

/** The only venue with a trained detector today. Overridable via route param. */
const DEFAULT_DETECTOR_VENUE = 'indian-museum';

// After a real (production) scan we invite the user to share — but at most once a
// day so it never nags. Skipped entirely for the dev "scan anything" path.
const SHARE_PROMPT_KEY = '@epocheye/last_share_prompt';
const SHARE_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function maybePromptShare(
  allowUngrounded: boolean,
  open: (v: boolean) => void,
): Promise<void> {
  if (allowUngrounded) return; // dev scan has no real site to share
  try {
    const raw = await AsyncStorage.getItem(SHARE_PROMPT_KEY);
    const last = raw ? parseInt(raw, 10) : 0;
    if (Date.now() - last < SHARE_PROMPT_COOLDOWN_MS) return;
    await AsyncStorage.setItem(SHARE_PROMPT_KEY, String(Date.now()));
    open(true);
  } catch {
    // Storage hiccup — just skip the prompt rather than nagging on every scan.
  }
}

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
  // 'ai' carries the card content so the caller can float it as AR placards.
  | {kind: 'ai'; label?: string | null; body?: string}
  | {kind: 'paywall'; paywall: {siteId: string; used: number; limit: number}}
  | {kind: 'limit'}
  // Statue-only gate at a venue refused a non-exhibit — show the polite tip.
  | {kind: 'rejected'; message?: string}
  | {kind: 'error'; message?: string};

/**
 * Pull a human-readable reason out of an axios/transport error so the dev test can
 * show WHY recognition failed (e.g. the backend's "recognition unavailable" / a
 * missing-key 503) instead of a black-box "couldn't reach the lens".
 */
function extractErrorMessage(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as {
    response?: {status?: number; data?: unknown};
    message?: string;
  };
  let body: string | undefined;
  const data = e.response?.data;
  if (typeof data === 'string') body = data;
  else if (data && typeof data === 'object') {
    const d = data as {error?: unknown; message?: unknown};
    if (typeof d.error === 'string') body = d.error;
    else if (typeof d.message === 'string') body = d.message;
  }
  body = body ?? e.message;
  const status = e.response?.status;
  if (body && status) return `[${status}] ${body}`;
  return body ?? (status ? `HTTP ${status}` : undefined);
}

/** Split long narration into up to `max` chunks (~`size` chars, on word boundaries). */
function chunkText(s: string, size: number, max: number): string[] {
  const text = s.trim();
  if (!text) return [];
  const out: string[] = [];
  let rest = text;
  while (rest.length > 0 && out.length < max) {
    if (rest.length <= size) {
      out.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return out;
}

/**
 * Build the JSON cards array for `placeCardsOnly` from an AI interpretation: card 0
 * carries the label + first chunk (amber "inferred" badge); long text spills into
 * 1–2 body-only continuation cards spread at other positions.
 */
function buildArCards(label: string | null, body: string): string {
  const chunks = chunkText(body, 300, 3);
  const cards =
    chunks.length === 0
      ? [{display_name: label ?? 'AI interpretation', identity_confidence: 'inferred', narrative: body}]
      : chunks.map((chunk, i) =>
          i === 0
            ? {
                display_name: label ?? 'AI interpretation',
                identity_confidence: 'inferred',
                narrative: chunk,
              }
            : {continuation: true, narrative: chunk},
        );
  return JSON.stringify(cards);
}

/**
 * Shared resolution engine. The PRIMARY recognizer is the server-side three-layer
 * agent behind POST /api/v1/recognize:
 *
 *   - match 'grounded'          → fetch the grounded data card (GET /vision/object)
 *                                 and place that class's model. A grounded card wins.
 *   - match 'ai_interpretation' → a clearly-labelled, non-streaming "AI" card.
 *   - match 'paywall'           → free scans spent at this venue → route to purchase.
 *
 * DEV "scan anything" (allowUngrounded) and the documented out_of_venue case fall
 * back to the universal museum-mode identify (POST /api/v1/vision/identify, the
 * cheap streaming identifier) so the test works on any object — and keeps working
 * even when the agent endpoint isn't reachable/deployed. Streamed narration feeds
 * the same AI card (with the live typewriter).
 *
 * Grounded and AI content never co-exist. Returns the outcome so the caller can
 * place the model, route to the paywall, or show a retry message.
 */
function useDetectionResolver(venueSlug: string, allowUngrounded = false) {
  const [resolved, setResolved] = useState<ResolvedState>({kind: 'idle'});
  // Free scans left at this venue after the latest serve (null when ungated/dev).
  const [remaining, setRemaining] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setResolved({kind: 'idle'});
  }, []);

  useEffect(() => () => abortRef.current?.(), []);

  // Universal identify fallback: streams an "AI interpretation" card for any
  // object via the deployed museum-mode endpoint. Resolves the outcome as soon as
  // the object label arrives so the card shows immediately and narration continues
  // streaming in; the stream is aborted on reset/unmount via abortRef.
  const runMuseumFallback = useCallback(
    (imageUri: string, priorMessage?: string): Promise<ResolutionOutcome> =>
      new Promise<ResolutionOutcome>(resolve => {
        let settled = false;
        const finish = (outcome: ResolutionOutcome) => {
          if (!settled) {
            settled = true;
            resolve(outcome);
          }
        };
        setResolved({kind: 'ai', label: null, text: '', streaming: true});
        abortRef.current?.();
        abortRef.current = streamMuseumNarration({
          imageUri,
          onObject: label => {
            setResolved(prev =>
              prev.kind === 'ai'
                ? {...prev, label}
                : {kind: 'ai', label, text: '', streaming: true},
            );
            finish({kind: 'ai'});
          },
          onChunk: chunk => {
            setResolved(prev =>
              prev.kind === 'ai'
                ? {...prev, text: prev.text + chunk}
                : {kind: 'ai', label: null, text: chunk, streaming: true},
            );
          },
          onDone: () => {
            setResolved(prev =>
              prev.kind === 'ai' ? {...prev, streaming: false} : prev,
            );
            finish({kind: 'ai'});
          },
          onError: msg => {
            setResolved({kind: 'idle'});
            const reason = msg || priorMessage;
            if (__DEV__) {
              console.warn('[detect] museum identify failed:', reason);
            }
            finish({kind: 'error', message: reason});
          },
          onPaywall: info =>
            finish({
              kind: 'paywall',
              paywall: {
                siteId: info.siteId || venueSlug,
                used: info.used,
                limit: info.limit,
              },
            }),
        });
      }),
    [venueSlug],
  );

  const runResolution = useCallback(
    async (
      frameBase64: string,
      imageUri?: string,
    ): Promise<ResolutionOutcome> => {
      let result;
      try {
        result = await recognize({
          imageBase64: frameBase64,
          venueId: venueSlug,
          allowUngrounded,
        });
      } catch (err) {
        const message = extractErrorMessage(err);
        if (__DEV__) {
          console.warn('[detect] recognize failed:', message ?? err);
        }
        // Agent endpoint unreachable/errored — in dev "scan anything", still try the
        // deployed universal identify so the test isn't blocked on a deploy.
        if (allowUngrounded && imageUri) return runMuseumFallback(imageUri, message);
        return {kind: 'error', message};
      }

      // Surface free scans left at this venue (for the "N scans left" pill).
      if (typeof result.remaining === 'number') {
        setRemaining(result.remaining);
      }

      // Per-site free scans spent → caller routes to the Explorer-Pass purchase.
      if (result.match === 'paywall') {
        return {
          kind: 'paywall',
          paywall: result.paywall ?? {siteId: venueSlug, used: 0, limit: 0},
        };
      }

      // Daily exploration budget reached (a soft circuit breaker) → gentle message.
      if (result.match === 'daily_limit') {
        return {kind: 'limit'};
      }

      // Statue-only gate refused a non-exhibit at this venue → polite block.
      if (result.match === 'out_of_scope') {
        setResolved({kind: 'idle'});
        return {kind: 'rejected', message: result.message};
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
        const label = result.card.title || null;
        const body = result.card.body || '';
        setResolved({kind: 'ai', label, text: body, streaming: false});
        return {kind: 'ai', label, body};
      }

      // out_of_venue / unexpected. In dev "scan anything" this is expected (no
      // seeded venue), so fall back to the universal identify on the frame.
      if (allowUngrounded && imageUri) {
        return runMuseumFallback(imageUri, `agent: ${result.match}`);
      }
      return {kind: 'error', message: `agent: ${result.match}`};
    },
    [venueSlug, allowUngrounded, runMuseumFallback],
  );

  return {resolved, runResolution, reset, remaining};
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

  // DEV "scan anything": same live scan UX as production, but the agent runs
  // ungrounded (any object, no venue) so it can be tested at home. The venue gate
  // is bypassed above. Production keeps geofencing + grounded recognition.
  const allowUngrounded = devPicker;
  const effectiveVenue = devPicker ? venueSlug || 'dev' : venueSlug;

  if (useNativeAR) {
    return (
      <DetectARNative
        venueSlug={effectiveVenue}
        allowUngrounded={allowUngrounded}
        onClose={handleClose}
      />
    );
  }
  return (
    <DetectAR2D
      venueSlug={effectiveVenue}
      allowUngrounded={allowUngrounded}
      onClose={handleClose}
    />
  );
};

// ============================================================
// PRODUCTION native AR: detect → grounded card → world-anchored model
// ============================================================

const DetectARNative: React.FC<{
  venueSlug: string;
  onClose: () => void;
  allowUngrounded?: boolean;
}> = ({venueSlug, onClose, allowUngrounded = false}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const arRef = useRef<EpocheyeDetectARHandle>(null);
  const [status, setStatus] = useState<ARStatus>('initializing');
  const [tracking, setTracking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // The model to render — set from the DETECTED class (not a hardcoded marquee).
  const [glbUri, setGlbUri] = useState<string | null>(null);
  const {resolved, runResolution, reset, remaining} = useDetectionResolver(
    venueSlug,
    allowUngrounded,
  );

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
        // the hook; a spent allowance routes to purchase. `uri` lets the dev
        // "scan anything" path fall back to the universal identify.
        const resolution = await runResolution(base64, uri);
        if (resolution.kind === 'grounded' || resolution.kind === 'minimal') {
          const modelUri = await resolveModelGlb(resolution.classId);
          if (modelUri) setGlbUri(modelUri);
          // The recognizer no longer returns a detector bounding box. The user aimed
          // at the artifact, so anchor near the screen centre; native defers
          // placement until the model + TRACKING are both ready. (Precise hit-test
          // placement / AR placard UI is a later step.)
          arRef.current?.placeFromDetection(0.5, 0.85);
          setErrorMessage(null);
          void maybePromptShare(allowUngrounded, setShareOpen);
        } else if (resolution.kind === 'paywall') {
          navigation.navigate(ROUTES.MAIN.PURCHASE, {preSelectedPlaceId: venueSlug});
        } else if (resolution.kind === 'limit') {
          setErrorMessage(
            'You’ve explored a lot here today — come back tomorrow for more.',
          );
        } else if (resolution.kind === 'rejected') {
          // Statue-only gate: calm tip, no card, nothing placed.
          arRef.current?.clearAnchor();
          setGlbUri(null);
          setErrorMessage(
            resolution.message ??
              'Point at a museum sculpture or artifact to explore it.',
          );
        } else if (resolution.kind === 'error') {
          setErrorMessage(
            __DEV__ && resolution.message
              ? `Lens error — ${resolution.message}`
              : 'Couldn’t reach the lens — try again',
          );
        } else if (resolution.kind === 'ai') {
          // AI interpretation of an allowed statue. In a real venue (not DEV),
          // float the card(s) in the world beside the statue — no 3D model. DEV
          // "scan anything" keeps just the on-screen card.
          if (!allowUngrounded && resolution.body) {
            arRef.current?.placeCardsOnly(
              0.5,
              0.85,
              buildArCards(resolution.label ?? null, resolution.body),
            );
          }
          setErrorMessage(null); // labelled card also shown on-screen by the hook
          void maybePromptShare(allowUngrounded, setShareOpen);
        }
      } catch {
        setErrorMessage('Detection failed — try again');
      } finally {
        setDetecting(false);
      }
    },
    [runResolution, navigation, venueSlug, allowUngrounded],
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
            <Text style={styles.title}>
              {allowUngrounded ? 'DEV · Scan anything' : 'Scan artifact'}
            </Text>
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
        {remaining != null ? (
          <View style={styles.scansPill} pointerEvents="none">
            <Text style={styles.scansPillText}>
              {remaining} {remaining === 1 ? 'scan' : 'scans'} left here
            </Text>
          </View>
        ) : null}
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

      <ShareExperienceModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        siteSlug={venueSlug}
      />
    </View>
  );
};

// ============================================================
// NON-AR fallback: scan → data card only (no 3D model)
// ============================================================

const DetectAR2D: React.FC<{
  venueSlug: string;
  onClose: () => void;
  allowUngrounded?: boolean;
}> = ({venueSlug, onClose, allowUngrounded = false}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const cameraRef = useRef<VisionCamera | null>(null);
  const device = useCameraDevice('back');

  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const {resolved, runResolution, remaining} = useDetectionResolver(
    venueSlug,
    allowUngrounded,
  );

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
      // vision-camera returns a bare filesystem path; the SSE upload (FormData)
      // and image prep need a file:// URI to read it.
      const imageUri = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;
      const base64 = await prepareImageForGemini(imageUri);
      // Same precedence as AR; no 3D model here (this device can't do AR, and the
      // compressed CDN GLBs aren't decodable by the JS viewer) — the card is the
      // surface. imageUri lets the dev "scan anything" path fall back to identify.
      const resolution = await runResolution(base64, imageUri);
      if (resolution.kind === 'paywall') {
        navigation.navigate(ROUTES.MAIN.PURCHASE, {preSelectedPlaceId: venueSlug});
      } else if (resolution.kind === 'limit') {
        setMessage('You’ve explored a lot here today — come back tomorrow for more.');
      } else if (resolution.kind === 'rejected') {
        setMessage(
          resolution.message ??
            'Point at a museum sculpture or artifact to explore it.',
        );
      } else if (resolution.kind === 'error') {
        setMessage(
          __DEV__ && resolution.message
            ? `Lens error — ${resolution.message}`
            : 'Couldn’t reach the lens — try again',
        );
      } else {
        setMessage(null);
        void maybePromptShare(allowUngrounded, setShareOpen);
      }
    } catch {
      setMessage('Detection failed — try again');
    } finally {
      setBusy(false);
    }
  }, [busy, runResolution, navigation, venueSlug, allowUngrounded]);

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
            <Text style={styles.title}>
              {allowUngrounded ? 'DEV · Scan anything' : 'Scan artifact'}
            </Text>
            <Text style={styles.subtitle}>identify · no AR on this device</Text>
          </View>
          <View style={styles.iconButton} />
        </View>
        {remaining != null ? (
          <View style={styles.scansPill} pointerEvents="none">
            <Text style={styles.scansPillText}>
              {remaining} {remaining === 1 ? 'scan' : 'scans'} left here
            </Text>
          </View>
        ) : null}
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

      <ShareExperienceModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        siteSlug={venueSlug}
      />
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
  scansPill: {
    alignSelf: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  scansPillText: {
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
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
