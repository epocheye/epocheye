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
import {useTranslation} from 'react-i18next';
import Video from 'react-native-video';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';

import EpocheyeDetectARView, {
  isDetectARAvailable,
  type CloudAnchorEvent,
  type EpocheyeDetectARHandle,
  type GeospatialStateEvent, // ADMIN-HARNESS (REMOVE AFTER KONARK)
  type FigureGeometryEvent,
  type FrameStatsEvent, // PHASE 0 frame-time probe
  type ModelAnimationsEvent, // PHASE 0 skeletal-animation probe
  type VpsResultEvent, // ADMIN-HARNESS (REMOVE AFTER KONARK)
} from '../../native/EpocheyeDetectARView';
// ADMIN-HARNESS (REMOVE AFTER KONARK) — statically imported (was __DEV__ require)
// so the admin overlay ships in release, gated at render time by isAdminUser().
import DevCloudAnchorOverlay from '../Dev/DevCloudAnchorOverlay';
import {isAdminUser} from '../../shared/auth/isAdminUser';
import {useUserStore} from '../../stores/userStore';
import {useARCore} from '../../shared/hooks/useARCore';
import {prepareImageForGemini} from '../../services/geminiVisionService';
import {PermissionService} from '../../shared/services/permission.service';
import {resolveModelGlb} from '../../services/glbSource';
import {siteTelemetry} from '../../services/siteTelemetry';
// getOrFetchGlb runs a full GLB URL through the SAME on-device download+cache
// path production uses (via glbSource → getOrFetchGlb). Used ONLY by the
// __DEV__ direct-GLB render test below.
import {getOrFetchGlb} from '../../services/glbCache';
import {
  recognize,
  pollResearch,
  type ResearchCard,
} from '../../services/recognizeService';
import {getValidAccessToken} from '../../utils/api/auth/Login';
import {streamMuseumNarration} from '../../services/museumModeService';
// fetchObjectCard is the grounded data-card lookup (GET /vision/object/{class_id});
// it is NOT the Roboflow detector. Roboflow (roboflowDetectionService /
// resolveDetection) is retired off the live recognition path — kept dormant in the
// repo behind ROBOFLOW_ENABLED for a possible future cheap pre-filter.
import {fetchObjectCard, type ObjectCard} from '../../services/detectorResolver';
import {useVenueGate} from '../../shared/hooks/useVenueGate';
import {useARSafetyGate} from '../../shared/hooks/useARSafetyGate';
import {useNarrationLang} from '../../stores/museumPrefsStore';
import {usePlacesStore} from '../../stores/placesStore';
import {analytics} from '../../services/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroundedObjectCard from './components/GroundedObjectCard';
import AiGuessCard from './components/AiGuessCard';
import ScanGuideOverlay, {type ScanPhase} from './components/ScanGuideOverlay';
import OfflineInline from '../../components/ui/OfflineInline';
import {useNetwork} from '../../context/NetworkContext';
import ARActivationOverlay from '../../components/ui/ARActivationOverlay';
import ARSafetyNotice from '../../components/ui/ARSafetyNotice';
import ArSessionBanner from '../../components/ui/ArSessionBanner';
import { useArSessionHealth } from '../../shared/hooks/useArSessionHealth';
import {
  parseTrackingFailure,
  trackingHintKey,
} from '../../features/ar/trackingHint';
import i18next from 'i18next';
import ShareExperienceModal from '../../components/ShareExperienceModal';
import {ROUTES} from '../../core/constants';
import {COLORS} from '../../core/constants/theme';
import i18n from '../../i18n';
import type {MainStackParamList} from '../../core/types/navigation.types';
import {aimCoaching} from '../../features/ar/aimCoach';

// Primary accent for the scan screen — the theme's sky token (was a stale amber
// hex). Named AMBER for historical reasons; it now drives the current palette.
const AMBER = COLORS.sky;
const YAW_STEP_DEG = 15;

// __DEV__ only: largest-dimension size (metres) for the "Direct GLB render test"
// dev path. The native view scales any model so its biggest axis == this many
// metres (scaleToUnits), and it auto-places ~1.2 m in front of the camera — so
// ~1.2 gives a human-scale statue that fills the frame. Tune this one line if the
// test model looks too small/large. Never applied to the real recognition path.
const DIRECT_GLB_TEST_SCALE_M = 1.2;
/**
 * How long the direct-GLB harness waits for ARCore to find a plane before placing
 * anyway. Long enough for a normal sweep of a lit, textured floor; short enough
 * that a featureless room still shows something rather than hanging forever.
 */
// Depth is usually available within a second or two of tracking starting; this is now
// a short warm-up, not a wait for plane fitting to succeed.
const PLANE_WAIT_MS = 2500;

/**
 * Plain-words reading of ARCore's TrackingFailureReason for the DEV probe banner.
 *
 * The real mapping now lives in `src/features/ar/trackingHint.ts` and is i18n'd,
 * because this copy was private to this file AND only rendered behind `devDirectGlb`
 * — production never reached it while raw enum names went to visitors on another
 * screen. This wrapper keeps the loud, upper-case dev wording (useful at arm's length
 * on site) without being a second source of truth for the words visitors see.
 */
function trackingHint(why: string, torch = false): string {
  const reason = parseTrackingFailure(why);
  const key = trackingHintKey(reason, torch);
  if (!key) {
    return 'SCANNING FOR THE FLOOR — point down and sweep the phone slowly side to side.';
  }
  return i18next.t(key);
}


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
  // grounded/minimal carry the resolved card so the caller can float it as an AR
  // placard when the class has no 3D model (heritage places).
  | {kind: 'grounded' | 'minimal'; classId: string; card: ObjectCard}
  // 'ai' carries the card content so the caller can float it as AR placards.
  | {kind: 'ai'; label?: string | null; body?: string}
  | {kind: 'paywall'; paywall: {siteId: string; used: number; limit: number}}
  | {kind: 'limit'}
  // Statue-only gate at a venue refused a non-exhibit — show the polite tip.
  | {kind: 'rejected'; message?: string}
  // Scan was cancelled (screen left or reset) — the caller ignores it.
  | {kind: 'aborted'}
  | {kind: 'error'; message?: string};

/**
 * Pull a human-readable reason out of an axios/transport error so the dev test can
 * show WHY recognition failed (e.g. the backend's "recognition unavailable" / a
 * missing-key 503) instead of a black-box "couldn't reach the lens".
 */
function extractErrorMessage(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as {
    code?: string;
    config?: {url?: string; method?: string};
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
  // No HTTP response = a transport failure (axios surfaces this as the opaque
  // "Network Error"). In dev, append the axios code + the endpoint + method so
  // the on-screen "Lens error —" line actually says WHICH call failed and HOW,
  // instead of a dead-end message (e.g. "ERR_NETWORK · POST …/api/v1/recognize").
  if (__DEV__ && !e.response) {
    const endpoint = e.config?.url
      ? ` · ${(e.config.method ?? 'get').toUpperCase()} ${e.config.url}`
      : '';
    const code = e.code ? `${e.code}: ` : '';
    return `${code}${body ?? 'no response'}${endpoint}`;
  }
  return body ?? (status ? `HTTP ${status}` : undefined);
}

// Upper bound on world-anchored placards. Kept in lock-step with the native
// cardLayoutFor(n) cap in EpocheyeDetectARView.kt so JS never emits more cards
// than the AR view will place (excess is folded into the last card, not dropped).
const MAX_AR_CARDS = 6;

/**
 * Split narration into COMPLETE sections for AR cards — one coherent block per
 * card, NEVER a mid-sentence cut. Splits on blank-line paragraph breaks first,
 * then packs whole sentences into ~`targetLen`-char groups. Nothing is dropped:
 * any sections beyond `maxSections` are merged back into the last one, so a long
 * narration produces more cards and a short one produces fewer.
 */
function splitIntoSections(
  raw: string | null | undefined,
  targetLen = 320,
  maxSections = MAX_AR_CARDS,
): string[] {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  // Paragraph units first (blank-line separated); whole text if there are none.
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  const sections: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= targetLen) {
      sections.push(para);
      continue;
    }
    // Sentence-aware packing: match sentences ending in . ! ? (keeping any
    // trailing quote/bracket), plus a trailing fragment with no terminator.
    const sentences = para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para];
    let buf = '';
    for (const s of sentences) {
      const sentence = s.trim();
      if (!sentence) continue;
      if (buf && buf.length + 1 + sentence.length > targetLen) {
        sections.push(buf);
        buf = sentence;
      } else {
        buf = buf ? `${buf} ${sentence}` : sentence;
      }
    }
    if (buf) sections.push(buf);
  }

  if (sections.length === 0) return [text];
  // Never drop content: fold overflow past the cap into the final card.
  if (sections.length > maxSections) {
    return [
      ...sections.slice(0, maxSections - 1),
      sections.slice(maxSections - 1).join(' '),
    ];
  }
  return sections;
}

/**
 * Build the JSON cards array for `placeCardsOnly` from an AI interpretation. The
 * narration is split into complete sentence/paragraph sections (not fixed-length
 * slices): card 0 carries the label + first section; each further section is its
 * own body-only continuation card. Card count scales with how much text there is.
 */
function buildArCards(label: string | null, body: string): string {
  const name = label ?? i18n.t('lens.thisObject');
  const sections = splitIntoSections(body);
  const cards =
    sections.length === 0
      ? [{display_name: name, identity_confidence: 'inferred', narrative: body}]
      : sections.map((section, i) =>
          i === 0
            ? {display_name: name, identity_confidence: 'inferred', narrative: section}
            : {continuation: true, narrative: section},
        );
  return JSON.stringify(cards);
}

/**
 * Build the `placeCardsOnly` JSON for a GROUNDED card with no 3D model. Instead of
 * blindly char-chunking the narrative, this maps the card's REAL sections to their
 * own complete placards: an identity card (name + meta + first narrative section),
 * any further narrative sections, a headed "What to look for" card from the
 * iconography, and one headed card per context/timeline layer. The count therefore
 * scales with how much data the object actually has. The rich on-screen flat card
 * (with its layer slider) still renders separately — these are the world placards.
 */
function buildGroundedArCards(card: ObjectCard): string {
  const cards: Record<string, unknown>[] = [];

  const narrativeSections = splitIntoSections(card.narrative);
  cards.push({
    display_name: card.display_name,
    identity_confidence: card.identity_confidence,
    period: card.period,
    dynasty: card.dynasty,
    material: card.material,
    origin: card.origin,
    narrative: narrativeSections[0] ?? '',
  });
  for (const section of narrativeSections.slice(1)) {
    cards.push({continuation: true, narrative: section});
  }

  // "What to look for" — iconography as its own headed card(s). Label matches the
  // on-screen GroundedObjectCard heading.
  const iconSections = splitIntoSections(card.iconography);
  iconSections.forEach((section, i) => {
    cards.push({
      continuation: true,
      ...(i === 0 ? {heading: 'What to look for'} : {}),
      narrative: section,
    });
  });

  // Timeline / context layers — one headed card each (layer label → heading).
  for (const layer of card.context_layers ?? []) {
    const layerBody = (layer.body ?? '').trim();
    if (!layerBody) continue;
    cards.push({continuation: true, heading: layer.label, narrative: layerBody});
  }

  // Cap to what native places; fold any overflow into the last card (never drop).
  if (cards.length > MAX_AR_CARDS) {
    const tail = cards.slice(MAX_AR_CARDS - 1);
    const mergedNarrative = tail
      .map(c => c.narrative as string)
      .filter(Boolean)
      .join('\n\n');
    const capped = cards.slice(0, MAX_AR_CARDS - 1);
    capped.push({...tail[0], narrative: mergedNarrative});
    return JSON.stringify(capped);
  }
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
  // Narration content language (en/hi/bn) — passed to the museum-mode stream.
  const narrationLang = useNarrationLang();
  // Free scans left at this venue after the latest serve (null when ungated/dev).
  const [remaining, setRemaining] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  // Aborts an in-flight recognize submit/poll so leaving the screen (or resetting)
  // doesn't leave the up-to-45s poll loop running in the background.
  const recognizeAbortRef = useRef<AbortController | null>(null);
  // The background research run for the scan just placed, and its stop function.
  // Research is the SECOND job: the identification is already on screen by the
  // time it starts, and the card it produces replaces that card's text without
  // moving it.
  const pendingResearchRef = useRef<{
    runId?: string;
    cards?: ResearchCard[];
  } | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    recognizeAbortRef.current?.abort();
    recognizeAbortRef.current = null;
    // Forget the research handles for the scan being discarded. Without this a
    // run started by the PREVIOUS scan could land while a different object is
    // anchored and overwrite that object's card with another one's history.
    pendingResearchRef.current = null;
    setResolved({kind: 'idle'});
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.();
      recognizeAbortRef.current?.abort();
    },
    [],
  );

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
          lang: narrationLang,
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
    [venueSlug, narrationLang],
  );

  const runResolution = useCallback(
    async (
      frameBase64: string,
      imageUri?: string,
    ): Promise<ResolutionOutcome> => {
      // Dev diagnostic: the prepared frame size. prepareImageForGemini normally
      // resizes to ~100–400 KB, but silently returns the raw full-res base64
      // (3–10 MB) if Skia resize fails — an oversized body can be dropped by API
      // Gateway and surface as an opaque "Network Error". A frameKB in the
      // thousands is the smoking gun; it's appended to the on-screen error below
      // so it's visible without adb.
      const frameKB = Math.round((frameBase64.length * 3) / 4 / 1024);
      if (__DEV__) {
        console.warn(
          `[detect] recognize submit venue=${venueSlug} ungrounded=${allowUngrounded} frameKB=${frameKB}`,
        );
      }
      // Elapsed time to failure is the decisive signal for an ERR_NETWORK: a
      // near-instant fail (<1s) is a real connection reset; a fail at ~10s is the
      // SUBMIT_TIMEOUT_MS firing (RN surfaces XHR timeouts as ERR_NETWORK), i.e. a
      // slow/synchronous backend, not a transport problem. Both frameKB and the
      // elapsed ms are appended to the on-screen error so it's visible without adb.
      const startedAt = Date.now();
      const withDiag = (msg?: string) =>
        __DEV__
          ? `${msg ?? 'error'} (frameKB=${frameKB}, ${Date.now() - startedAt}ms)`
          : msg;
      // Cancel any prior in-flight recognize, then run this one under a fresh
      // controller so reset()/unmount can abort the submit + poll loop.
      recognizeAbortRef.current?.abort();
      const controller = new AbortController();
      recognizeAbortRef.current = controller;

      let result;
      try {
        result = await recognize(
          {
            imageBase64: frameBase64,
            venueId: venueSlug,
            allowUngrounded,
          },
          controller.signal,
        );
      } catch (err) {
        // Cancelled (screen left / reset) — drop it silently, no error UI.
        if (controller.signal.aborted) {
          return {kind: 'aborted'};
        }
        const message = withDiag(extractErrorMessage(err));
        if (__DEV__) {
          console.warn('[detect] recognize failed:', message ?? err);
        }
        analytics.track('scan_error', {venue: venueSlug});
        // Agent endpoint unreachable/errored — in dev "scan anything", still try the
        // deployed universal identify so the test isn't blocked on a deploy.
        if (allowUngrounded && imageUri) return runMuseumFallback(imageUri, message);
        return {kind: 'error', message};
      } finally {
        // Done with this controller; clear it if it's still the latest.
        if (recognizeAbortRef.current === controller) {
          recognizeAbortRef.current = null;
        }
      }

      // Carry the research handles out to the placement site. Cards present here
      // were researched by an EARLIER visitor and came straight from the database
      // with no model call; a run id means one is happening now.
      pendingResearchRef.current = {
        runId: result.research_run_id,
        cards: result.research_cards,
      };

      // One event covers every recognition outcome (grounded/ai/paywall/
      // out_of_scope/out_of_venue/daily_limit) for the scan funnel + breakdowns.
      analytics.track('scan_result', {
        venue: venueSlug,
        match: result.match,
        class_id: result.class_id,
        allow_ungrounded: allowUngrounded,
      });

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
            return {
              kind: minimal ? 'minimal' : 'grounded',
              classId: result.class_id,
              card,
            };
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

  return {resolved, runResolution, reset, remaining, pendingResearchRef};
}

const DetectArScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute() as unknown as RouteParam;
  const venueSlug = route.params?.venueSlug ?? DEFAULT_DETECTOR_VENUE;
  const devPicker = route.params?.devPicker === true;
  // Guided product tour: show the camera as a preview, bypassing the venue/GPS
  // gate. The tour overlay (TourHost) blocks all touches, so no scan can run.
  const tour = route.params?.tour === true;
  // __DEV__ direct-GLB render test: a full GLB URL passed from the dev
  // Health-Check board. When present, the native AR view loads THIS model and
  // auto-places it ~1.2 m in front of the camera (placeInFront) with NO scan and
  // NO recognition — a pure "does the native SceneView/Filament renderer show a
  // GLB on this device" probe. Read only in dev; constant-folded to null in
  // release so this path is fully inert for normal users. Typed via a local cast
  // so no shared navigation param type has to change for a dev-only probe.
  // ADMIN-HARNESS (REMOVE AFTER KONARK) — the harness now ships in release but is
  // gated on the admin-email allowlist; __DEV__ keeps it on in debug for everyone.
  const adminEmail = useUserStore(s => s.profile?.email);
  const showAdminHarness = __DEV__ || isAdminUser(adminEmail);
  const devDirectGlb = showAdminHarness
    ? (route.params as {devDirectGlb?: string} | undefined)?.devDirectGlb ?? null
    : null;
  // Per-test scale override. The static statue probe wants ~1.2 m; a rigged human
  // wants ~1.7 m, and Fox wants ~1.0 m. Falls back to the statue default so the
  // existing direct-GLB check is untouched.
  const devGlbScaleM = showAdminHarness
    ? (route.params as {devGlbScaleM?: number} | undefined)?.devGlbScaleM ?? null
    : null;
  // Clip to play on a multi-clip test model. Without this the native side falls back
  // to SceneView's autoAnimate, which plays clip index 0 — on the merged Tipu figure
  // that is Idle_02, so the walk would be unreachable.
  const devAnimationClip = showAdminHarness
    ? (route.params as {devAnimationClip?: string} | undefined)?.devAnimationClip ??
      null
    : null;
  // Drop a surface-less anchor to the estimated floor. NOT the same thing as true
  // scale, though they were conflated until the figure rendered 1.7 cm tall: the
  // Meshy rig carries a 100x unit mismatch (skeleton in cm, mesh in m, one 0.01
  // root scale) which ONLY scaleToUnits normalisation hides. So the figure keeps
  // normalised sizing for a correct 1.7 m, and takes the floor drop from here.
  const devGroundAnchored = showAdminHarness
    ? (route.params as {devGroundAnchored?: boolean} | undefined)?.devGroundAnchored ??
      false
    : false;
  // Root motion for the figure. Speed is MEASURED off the clip (0.46 m/s), not
  // picked — see advanceWalk() in EpocheyeDetectARView.kt.
  // "Follow me" beat: after placement he turns his back, walks devWalkPath metres,
  // then stops and turns to face the visitor again.
  const devWalkPath = showAdminHarness
    ? (route.params as {devWalkPath?: number} | undefined)?.devWalkPath ?? 0
    : 0;
  const devWalkSpeed = showAdminHarness
    ? (route.params as {devWalkSpeed?: number} | undefined)?.devWalkSpeed ?? 0
    : 0;
  const devWalkDistance = showAdminHarness
    ? (route.params as {devWalkDistance?: number} | undefined)?.devWalkDistance ?? 0
    : 0;
  // Audio to play while the figure speaks. Kept as a plain URI rather than going
  // through the audio_stops/audio_clips tables: this is a harness, and the DB path
  // carries a persona/language matrix the figure does not have a row in yet.
  const devAudioUri = showAdminHarness
    ? (route.params as {devAudioUri?: string} | undefined)?.devAudioUri ?? null
    : null;
  // The honesty line, on screen.
  //
  // The figure says "I am not a recording" in his first spoken sentence, but a
  // visitor with the phone muted — in a gallery, on a bus, or simply with the volume
  // down — hears none of it and is shown an invented face with no warning at all.
  // A disclosure that only exists in audio is not a disclosure.
  const devDisclosure = showAdminHarness
    ? (route.params as {devDisclosure?: string} | undefined)?.devDisclosure ?? null
    : null;
  // __DEV__ Cloud Anchor harness: 'host' places the direct-GLB test model then
  // hosts its anchor as a persistent Cloud Anchor; 'resolve' resolves a saved/
  // pasted anchor ID and attaches the test model at the resolved pose. Only ever
  // passed by the dev Health-Check board (always together with devDirectGlb);
  // constant-folded to null in release like devDirectGlb above.
  const devCloudAnchor = showAdminHarness
    ? (route.params as {devCloudAnchor?: 'host' | 'resolve'} | undefined)
        ?.devCloudAnchor ?? null
    : null;
  // Geofence bypass ONLY — the venue lock is skipped in dev builds so the AR
  // experience can be tested anywhere (e.g. at home), and by the dev picker /
  // guided tour previews / direct-GLB test. Production (__DEV__ === false,
  // constant-folded out of release bundles) always enforces the geofence. NOTE:
  // this deliberately does NOT bypass the families safety notice below — that
  // must show for everyone.
  const geofenceBypass = __DEV__ || devPicker || tour || devDirectGlb != null;

  const {hasPermission, requestPermission} = useCameraPermission();
  const {arAvailable, arChecked} = useARCore();
  const {inVenue, evaluated: zoneEvaluated} = useVenueGate();
  const ensureLocationTracking = usePlacesStore(s => s.ensureLocationTracking);
  const permissionRequestedRef = useRef(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [gateTimedOut, setGateTimedOut] = useState(false);
  // Families-policy safety notice must be acknowledged before the camera opens.
  // Resets on every fresh mount (fullScreenModal), so it shows each AR launch.
  // `safety.exit` also owns the Android hardware-back interception for this
  // screen (see useARSafetyGate), so it doubles as the screen's close handler.
  const safety = useARSafetyGate();
  const safetyAck = safety.acknowledged;

  // Defer the OS camera prompt until the safety notice is acknowledged, so the
  // two never stack.
  useEffect(() => {
    if (!safetyAck || hasPermission || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    void requestPermission().then(granted => {
      if (!granted) setPermissionDenied(true);
    });
  }, [safetyAck, hasPermission, requestPermission]);

  // Make sure GPS is actually being acquired the moment the screen opens, so the
  // venue gate below can decide on a real fix instead of a stale/empty location.
  useEffect(() => {
    if (geofenceBypass) return;
    void ensureLocationTracking();
  }, [geofenceBypass, ensureLocationTracking]);

  // Stop waiting for a fix after a grace period so a GPS-less device still
  // reaches the "go to your nearest venue" screen instead of hanging.
  useEffect(() => {
    if (geofenceBypass || inVenue) return;
    const t = setTimeout(() => setGateTimedOut(true), 12000);
    return () => clearTimeout(t);
  }, [geofenceBypass, inVenue]);

  // Venue lock: the live scan/AR experience only runs inside a curated venue.
  // This runs AFTER the families safety notice below, so a user always sees the
  // dismissible notice first regardless of location; only after acknowledging
  // does an out-of-venue user get redirected to GoToVenue.
  // CRITICAL: do NOT bounce the user the instant the screen mounts — and do NOT
  // key the redirect off `currentLocation`. `currentLocation` is set one
  // microtask BEFORE the geofence is evaluated (placesStore sets it
  // synchronously, then schedules checkZoneEntry), so gating on it ejects a
  // user standing INSIDE a venue before their zone is set. Wait until the zone
  // has actually been evaluated (`zoneEvaluated`) or the grace period elapses;
  // only then redirect if still outside. Dev builds / dev picker / tour bypass
  // the gate (see geofenceBypass).
  const locating =
    !geofenceBypass && !inVenue && !zoneEvaluated && !gateTimedOut;
  useEffect(() => {
    if (geofenceBypass || inVenue) return;
    if (zoneEvaluated || gateTimedOut) {
      navigation.replace(ROUTES.MAIN.GO_TO_VENUE);
    }
  }, [geofenceBypass, inVenue, zoneEvaluated, gateTimedOut, navigation]);

  // Route both the in-screen close button AND the Android hardware back button
  // through the safe-back path so exiting the camera can never fall through to
  // finishing the activity (which would close the whole app). This is the same
  // callback the safety gate exits through (useARSafetyGate wraps
  // useSafeBackHandler), so the hardware-back listener is registered once.
  const handleClose = safety.exit;

  // Families-policy gate: the safety notice is the FIRST thing shown when the AR
  // session opens — BEFORE the venue gate — so it is reachable regardless of
  // location (Google Play Families policy; reviewers are never physically at a
  // venue). Acknowledge ("I understand") to proceed; "Go back" / Android
  // hardware back exits. It shows for EVERYONE with no exceptions — do not add a
  // bypass here. It also gates the OS camera prompt (see the effect above) so
  // the two never stack.
  if (!safetyAck) {
    return (
      <ARSafetyNotice
        onAcknowledge={safety.acknowledge}
        onExit={handleClose}
      />
    );
  }

  // Venue lock render guard (runs after the safety notice above): outside a
  // curated venue, show the "locating" state and then redirect to GoToVenue.
  // Bypassed in dev builds / dev picker / tour (see geofenceBypass).
  if (!geofenceBypass && !inVenue) {
    if (locating) {
      return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.fallbackBlock}>
            <ActivityIndicator color={AMBER} />
            <Text style={styles.fallbackHeading}>{t('lens.locatingTitle')}</Text>
            <Text style={styles.fallbackBody}>{t('lens.locatingBody')}</Text>
          </View>
        </SafeAreaView>
      );
    }
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
          <Text style={styles.fallbackHeading}>{t('lens.cameraTitle')}</Text>
          <Text style={styles.fallbackBody}>{t('lens.cameraBody')}</Text>
          {permissionDenied ? (
            <Pressable
              onPress={() => void PermissionService.openAppSettings()}
              style={styles.fallbackButton}>
              <SettingsIcon size={14} color="#1A0F00" />
              <Text style={styles.fallbackButtonText}>{t('lens.openSettings')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void requestPermission()}
              style={styles.fallbackButton}>
              <Text style={styles.fallbackButtonText}>{t('lens.allowCamera')}</Text>
            </Pressable>
          )}
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.fallbackDismiss}>{t('lens.close')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // DEV "scan anything": same live scan UX as production, but the agent runs
  // ungrounded (any object, no venue) so it can be tested at home — via the dev
  // picker, or any dev build reached outside a venue (the geofence is auto-
  // bypassed above, so grounded recognition would otherwise have no venue to
  // match against). Production (__DEV__ === false, not devPicker) keeps
  // geofencing + grounded recognition against the real venueSlug.
  const allowUngrounded = devPicker || (__DEV__ && !inVenue);
  const effectiveVenue = allowUngrounded ? venueSlug || 'dev' : venueSlug;

  // __DEV__ AR harness params only work on the NATIVE AR path. If this device
  // fell back to the 2D scan screen (no ARCore / module missing), say so
  // instead of silently dropping them — a plain scan screen here would fire
  // real recognize calls and make the harness look unwired.
  if (showAdminHarness && (devCloudAnchor || devDirectGlb) && !useNativeAR) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Text style={styles.fallbackHeading}>Dev AR harness unavailable</Text>
          <Text style={styles.fallbackBody}>
            This test needs the native ARCore view; this device/emulator fell
            back to the 2D scan path.
          </Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.fallbackDismiss}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (useNativeAR) {
    return (
      <DetectARNative
        venueSlug={effectiveVenue}
        allowUngrounded={allowUngrounded}
        onClose={handleClose}
        devDirectGlb={devDirectGlb}
        devGlbScaleM={devGlbScaleM}
        devAnimationClip={devAnimationClip}
        devGroundAnchored={devGroundAnchored}
        devWalkPath={devWalkPath}
        devWalkSpeed={devWalkSpeed}
        devWalkDistance={devWalkDistance}
        devAudioUri={devAudioUri}
        devDisclosure={devDisclosure}
        devCloudAnchor={devCloudAnchor}
        showAdminHarness={showAdminHarness} // ADMIN-HARNESS (REMOVE AFTER KONARK)
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

/**
 * Drives the cosmetic ScanGuideOverlay from the EXISTING scan state — it reads
 * the in-flight flag and the resolved outcome, never the recognizer directly, so
 * recognition timing is untouched. The only timing it owns is a ~600ms lock-on
 * hold before the on-screen result card is revealed (`cardReady`) and a brief
 * neutral "miss" dwell.
 *
 *  aiming → scanning (in-flight) → hit | miss → aiming
 */
function useScanPhase(inFlight: boolean) {
  const [scanPhase, setScanPhase] = useState<ScanPhase>('aiming');
  // The HIT lock-on plays first; the parent gates the result card on this.
  const [cardReady, setCardReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Scanning mirrors the existing in-flight flag directly — no parallel flow.
  useEffect(() => {
    if (inFlight) {
      clearTimer();
      setCardReady(false);
      setScanPhase('scanning');
    } else {
      // Ended without an outcome moving us on (e.g. a native AR error) → settle,
      // so the overlay can never stick in 'scanning'.
      setScanPhase(p => (p === 'scanning' ? 'aiming' : p));
    }
  }, [inFlight, clearTimer]);

  // Called with the resolved outcome so the frame can lock-on (hit) or dim (miss).
  const resolveScan = useCallback(
    (kind: ResolutionOutcome['kind']) => {
      clearTimer();
      if (kind === 'grounded' || kind === 'minimal' || kind === 'ai') {
        setScanPhase('hit');
        timerRef.current = setTimeout(() => {
          setCardReady(true);
          setScanPhase('aiming');
        }, 600);
      } else if (kind === 'error') {
        setScanPhase('miss');
        timerRef.current = setTimeout(() => setScanPhase('aiming'), 1600);
      } else {
        // rejected / paywall / limit / aborted — their own UI carries messaging.
        setCardReady(true);
        setScanPhase('aiming');
      }
    },
    [clearTimer],
  );

  const resetPhase = useCallback(() => {
    clearTimer();
    setCardReady(false);
    setScanPhase('aiming');
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return {scanPhase, cardReady, resolveScan, resetPhase};
}

// ============================================================
// PRODUCTION native AR: detect → grounded card → world-anchored model
// ============================================================

const DetectARNative: React.FC<{
  venueSlug: string;
  onClose: () => void;
  allowUngrounded?: boolean;
  /**
   * __DEV__ direct-GLB render test: a full GLB URL. When set, the model is
   * loaded through the production cache path and auto-placed in front of the
   * camera (placeInFront) with no scan. Always null/absent in release.
   */
  devDirectGlb?: string | null;
  /**
   * Scale (in scaleToUnits units) for the direct-GLB test model. Null → the
   * statue default. A rigged human needs ~1.7, Fox ~1.0.
   */
  devGlbScaleM?: number | null;
  /** Play this glTF clip by name on a multi-clip test model. */
  devAnimationClip?: string | null;
  /** Origin on the ground — drop surface-less anchors to the estimated floor. */
  devGroundAnchored?: boolean;
  /** Root-motion speed (m/s) and distance (m) for the walking figure. */
  devWalkPath?: number;
  devWalkSpeed?: number;
  devWalkDistance?: number;
  /** Audio to play while the figure speaks. */
  devAudioUri?: string | null;
  /** Honesty line shown on screen while the figure is present. */
  devDisclosure?: string | null;
  /**
   * __DEV__ Cloud Anchor harness mode. 'host' keeps the direct-GLB auto-place
   * and adds the host overlay; 'resolve' loads the test GLB WITHOUT placing it
   * and adds the resolve overlay. Always null/absent in release.
   */
  devCloudAnchor?: 'host' | 'resolve' | null;
  // ADMIN-HARNESS (REMOVE AFTER KONARK) — admin (or dev) → show the harness overlay
  // (mode-less: VPS probe + depth-occlusion toggle) over the plain scan screen too.
  showAdminHarness?: boolean;
}> = ({
  venueSlug,
  onClose,
  allowUngrounded = false,
  devDirectGlb = null,
  devGlbScaleM = null,
  devAnimationClip = null,
  devGroundAnchored = false,
  devWalkPath = 0,
  devWalkSpeed = 0,
  devWalkDistance = 0,
  devAudioUri = null,
  devDisclosure = null,
  devCloudAnchor = null,
  showAdminHarness = false,
}) => {
  const {t} = useTranslation();
  // Recognition needs the backend, so scanning is blocked offline — but the
  // camera stays mounted (see OfflineScanOverlay).
  const {isOffline} = useNetwork();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const arRef = useRef<EpocheyeDetectARHandle>(null);
  const researchStopRef = useRef<(() => void) | null>(null);


  const [status, setStatus] = useState<ARStatus>('initializing');
  const [activationDone, setActivationDone] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // The model to render — set from the DETECTED class (not a hardcoded marquee).
  const [glbUri, setGlbUri] = useState<string | null>(null);
  // True once an AR placard/model is in flight or anchored. On an AR device the
  // floating AR card IS the surface, so we hide the on-screen info card while one
  // is up — showing both would let the on-screen card block the AR view. Reset on
  // every fresh Detect / manual reset so the next scan re-evaluates.
  const [arCardShown, setArCardShown] = useState(false);
  const {resolved, runResolution, reset, remaining, pendingResearchRef} =
    useDetectionResolver(venueSlug, allowUngrounded);

  // A scan session is its own visit to the building: someone opened the camera
  // here, and how the room behaved for it is the measurement. Ends on unmount,
  // which is also how a summary survives a visitor who backs straight out.
  useEffect(() => {
    siteTelemetry.beginSession(venueSlug, 'scan');
    return () => siteTelemetry.endSession();
  }, [venueSlug]);

  /**
   * Apply an object's sourced history to the cards already standing in the world.
   *
   * Two ways this fires, and the difference is the whole economic argument for
   * the cache:
   *
   *   - `cards` present  -> an earlier visitor already paid for this research.
   *     It arrived on the recognize response itself, read from the database with
   *     ZERO model calls, and lands the moment the identification does.
   *   - `runId` present  -> nobody has researched this object before. This
   *     visitor's scan started a background run; we poll it and update the card
   *     in place when it finishes, which can be a minute later.
   *
   * The anchor is never re-acquired: `updateAnchoredCards` swaps what the cards
   * say where they already stand. And it is a no-op natively if nothing is
   * anchored, so a run that lands after the visitor has walked away or started a
   * new scan cannot resurrect a card.
   */
  const applyResearch = useCallback(() => {
    researchStopRef.current?.();
    researchStopRef.current = null;

    const pending = pendingResearchRef.current;
    if (!pending) return;

    if (pending.cards?.length) {
      arRef.current?.updateAnchoredCards(JSON.stringify(pending.cards));
      return;
    }
    if (!pending.runId) return;

    void (async () => {
      const token = await getValidAccessToken();
      researchStopRef.current = pollResearch(pending.runId!, token, cards => {
        arRef.current?.updateAnchoredCards(JSON.stringify(cards));
      });
    })();
  }, [pendingResearchRef]);

  const {scanPhase, cardReady, resolveScan, resetPhase} = useScanPhase(detecting);

  // A research poll outlives the request that started it, so unmount has to stop
  // it explicitly or it keeps polling for minutes after the screen has closed.
  useEffect(
    () => () => {
      researchStopRef.current?.();
      researchStopRef.current = null;
    },
    [],
  );

  const trackingRef = useRef(false);
  useEffect(() => {
    trackingRef.current = tracking;
  }, [tracking]);

  // The AI narration text we've already anchored as AR placards (DEV "scan
  // anything" path). Guards against re-placing on every React re-render; cleared
  // on reset / a fresh Detect so the next scan re-anchors.
  const placedAiTextRef = useRef<string | null>(null);

  // __DEV__ direct-GLB test: fired-once guard so the auto-place runs a single
  // time once tracking is up (the effect re-runs on every tracking/render tick).
  const directPlacedRef = useRef(false);
  // Ref AND state deliberately: the ref keeps the placement effect from firing
  // twice, the state exists so flipping it actually re-runs that effect.
  const planeWaitExpiredRef = useRef(false);

  // __DEV__ Cloud Anchor harness: last native lifecycle event, surfaced on the
  // overlay. Cleared when the session rebuilds (onReady re-fires) so the
  // overlay's state machine returns to idle instead of showing a stale state.
  const [cloudAnchorEvent, setCloudAnchorEvent] =
    useState<CloudAnchorEvent | null>(null);
  const handleCloudAnchorEvent = useCallback((e: CloudAnchorEvent) => {
    console.log('[cloud-anchor]', e);
    setCloudAnchorEvent(e);
  }, []);
  // __DEV__ resolve mode: fired-once guard for arming the test GLB (no placing).
  const resolveGlbArmedRef = useRef(false);
  // ADMIN-HARNESS (REMOVE AFTER KONARK) — depth-occlusion toggle state (default
  // off ⇒ the native render path is unchanged until an admin flips it).
  const [occlusionOn, setOcclusionOn] = useState(false);
  // ADMIN-HARNESS (REMOVE AFTER KONARK) — geospatial harness START/STOP (default
  // off ⇒ session stays geospatialMode DISABLED until an admin starts it).
  const [geoActive, setGeoActive] = useState(false);
  // ADMIN-HARNESS (REMOVE AFTER KONARK) — on-screen readouts so the harness is
  // usable on an UNTETHERED release build (no adb); fed by native onVpsResult /
  // onGeospatialState events, rendered in the admin overlay.
  // PHASE 0 skeletal-animation probe result (null until the model loads).
  const [modelAnimations, setModelAnimations] =
    useState<ModelAnimationsEvent | null>(null);
  const [frameStats, setFrameStats] = useState<FrameStatsEvent | null>(null);
  // Aim coaching. The verdict is computed and debounced natively; this is only the
  // decision of what to SAY and whether the story should wait for the visitor.
  const coaching = aimCoaching(frameStats?.aim ?? 'OK', frameStats?.aimAngleDeg ?? 0);
  const [figure, setFigure] = useState<FigureGeometryEvent | null>(null);
  // True once ARCore has actually found a horizontal surface. TRACKING arrives in
  // about a second; a usable plane takes several more of real motion, so the two
  // are not interchangeable — placing on the former is what put the figure in
  // mid-air.
  const [planeReady, setPlaneReady] = useState(false);
  const [planeWaitExpired, setPlaneWaitExpired] = useState(false);
  const [vpsResult, setVpsResult] = useState<VpsResultEvent | null>(null);
  const [geoState, setGeoState] = useState<GeospatialStateEvent | null>(null);
  const handleToggleGeospatial = useCallback((on: boolean) => {
    setGeoActive(on);
    // Clear the stale readout on STOP so the panel doesn't show a frozen pose.
    if (!on) setGeoState(null);
  }, []);

  const handleReady = useCallback(() => {
    setStatus(prev => (prev === 'placed' ? prev : 'searching'));
    if (devCloudAnchor) setCloudAnchorEvent(null);
  }, [devCloudAnchor]);

  const handleDetect = useCallback(() => {
    if (detecting) return;
    if (!trackingRef.current) {
      setErrorMessage(t('lens.moveToScanFirst'));
      return;
    }
    setDetecting(true);
    setErrorMessage(null); // the ScanGuideOverlay now owns the "Scanning…" cue
    setArCardShown(false); // re-show on-screen card until this scan anchors an AR one
    placedAiTextRef.current = null; // a new scan may anchor a fresh AR card
    analytics.track('scan_started', {venue: venueSlug, mode: 'ar'});
    arRef.current?.captureFrame();
  }, [detecting, venueSlug, t]);

  const handleFrameCaptured = useCallback(
    async (uri: string) => {
      try {
        const base64 = await prepareImageForGemini(uri);
        // Strict precedence (enforced server-side by the two-gate agent): a grounded
        // class wins → load THAT class's model and anchor it; an AI card is shown by
        // the hook; a spent allowance routes to purchase. `uri` lets the dev
        // "scan anything" path fall back to the universal identify.
        const resolution = await runResolution(base64, uri);
        if (resolution.kind === 'aborted') return; // scan cancelled — leave UI as-is
        resolveScan(resolution.kind); // drive the overlay lock-on / miss cue
        if (resolution.kind === 'grounded' || resolution.kind === 'minimal') {
          const modelUri = await resolveModelGlb(resolution.classId);
          if (modelUri) {
            // Has a 3D reconstruction → anchor the model near the screen centre; native
            // defers placement until the model + TRACKING are both ready, and the
            // grounded placard rides along on the model's anchor (see cardData prop).
            setGlbUri(modelUri);
            arRef.current?.placeFromDetection(0.5, 0.85);
          } else {
            // No reconstruction (e.g. a heritage place with no 3D model) → float the
            // grounded card itself as a world-anchored placard, mirroring the AI
            // card-only path. placeCardsOnly creates its OWN anchor, so no GLB is
            // needed.
            arRef.current?.placeCardsOnly(
              0.5,
              0.85,
              buildGroundedArCards(resolution.card),
            );
          }
          applyResearch();
          // Either branch puts a card/model in the air → hide the on-screen card so
          // it can't overlap and block the AR view.
          setArCardShown(true);
          setErrorMessage(null);
          void maybePromptShare(allowUngrounded, setShareOpen);
        } else if (resolution.kind === 'paywall') {
          navigation.navigate(ROUTES.MAIN.PURCHASE, {preSelectedPlaceId: venueSlug});
        } else if (resolution.kind === 'limit') {
          setErrorMessage(t('lens.dailyLimit'));
        } else if (resolution.kind === 'rejected') {
          // Statue-only gate: calm tip, no card, nothing placed.
          arRef.current?.clearAnchor();
          setGlbUri(null);
          setErrorMessage(resolution.message ?? t('lens.statueGate'));
        } else if (resolution.kind === 'error') {
          // LOG IT, do not only paint it. This message is the only thing that says
          // WHICH call failed and HOW ("[502] ..." or "ERR_NETWORK: ... · POST
          // /api/v1/recognize"), and until now it existed solely as pixels on a phone
          // in someone's hand. Reading it back required them to retype it. The
          // journey's step 4 was blind the same way and cost three rounds to diagnose.
          console.log(
            `[lens] resolution=error msg=${JSON.stringify(resolution.message ?? null)}`,
          );
          setErrorMessage(
            __DEV__ && resolution.message
              ? `Lens error — ${resolution.message}`
              : t('lens.identifyFailed'),
          );
        } else if (resolution.kind === 'ai') {
          console.log(`[lens] resolution=ai label=${JSON.stringify(resolution.label ?? null)}`);
          // AI interpretation of an allowed statue. In a real venue (not DEV),
          // float the card(s) in the world beside the statue — no 3D model. DEV
          // "scan anything" keeps just the on-screen card.
          if (!allowUngrounded && resolution.body) {
            arRef.current?.placeCardsOnly(
              0.5,
              0.85,
              buildArCards(resolution.label ?? null, resolution.body),
            );
            setArCardShown(true); // AR placard is up → hide the on-screen card
            applyResearch();
          }
          // DEV "scan anything" anchors its AR cards later (after the stream
          // completes) via the effect below, which hides the on-screen card then.
          setErrorMessage(null);
          void maybePromptShare(allowUngrounded, setShareOpen);
        }
      } catch {
        resolveScan('error'); // frame prep / placement failed → miss cue
        setErrorMessage(t('lens.detectionFailed'));
      } finally {
        setDetecting(false);
      }
    },
    [
      runResolution,
      resolveScan,
      navigation,
      venueSlug,
      allowUngrounded,
      t,
      applyResearch,
    ],
  );

  const handleTrackingState = useCallback((state: string) => {
    setTracking(state === 'TRACKING');
  }, []);
  const handlePlaneDetected = useCallback(() => {
    setPlaneReady(true);
    setStatus(prev => (prev === 'placed' ? prev : 'ready'));
  }, []);
  const handleAnchorPlaced = useCallback(() => {
    setStatus('placed');
    setErrorMessage(null);
    console.log(`[PHASE3] anchor placed -> devWalkPath=${devWalkPath} speed=${devWalkSpeed}`);
    // Let him settle and be seen standing before he turns and leads: walking the instant
    // he appears reads as a glitch rather than a decision.
    if (devWalkPath > 0) {
      setTimeout(() => {
        arRef.current?.walkPath(
          devWalkPath,
          devWalkSpeed > 0 ? devWalkSpeed : 0.46,
          'Thoughtful_Walk',
          'Idle_02',
        );
      }, 1800);
    }
  }, [devWalkPath, devWalkSpeed]);
  // PHASE 0 — the skeletal-animation verdict, read straight off the Filament
  // animator at load time. Kept in state (not just logged) so the answer is
  // legible ON THE DEVICE: this test gets run at arm's length in a room, and
  // requiring a Metro window to read the result would make it useless on site.
  const handleModelAnimations = useCallback((info: ModelAnimationsEvent) => {
    setModelAnimations(info);
    console.log(
      `[PHASE0] MODEL ANIMATIONS count=${info.count} names=${
        info.names.length ? info.names.join(', ') : '(none)'
      }`,
    );
  }, []);
  // Live AR health. DetectArScreen never subscribed to onThermalStatus at all, so a
  // throttling phone — the documented Bangalore Fort shutdown — produced no message
  // here whatsoever. Tracking failures also stop arriving on handleError as raw enum
  // names; that channel is now app faults only.
  const arHealth = useArSessionHealth();

  const handleError = useCallback((err: string) => {
    // Native emits '' when a tracking fault CLEARS. That is not a failure, so it
    // must not cancel an in-flight scan — it only takes the stale message down.
    if (!err) {
      setErrorMessage(null);
      return;
    }
    setDetecting(false);
    setErrorMessage(err);
  }, []);

  const handleReset = useCallback(() => {
    arRef.current?.clearAnchor();
    setGlbUri(null);
    setArCardShown(false); // AR card cleared → on-screen card may show again
    placedAiTextRef.current = null;
    reset();
    resetPhase();
    setStatus(prev => (prev === 'placed' ? 'ready' : prev));
  }, [reset, resetPhase]);

  const handleYaw = useCallback(() => arRef.current?.nudgeYaw(YAW_STEP_DEG), []);

  // DEV "scan anything": the AI narration streams in via runMuseumFallback, so its
  // final text isn't known at frame-capture time (unlike the venue path's
  // non-streaming card). Anchor the world placards once the stream completes,
  // mirroring the venue AI placement. Gated on allowUngrounded so it never
  // collides with the venue path's immediate placeCardsOnly in handleFrameCaptured.
  useEffect(() => {
    if (!allowUngrounded) return;
    if (resolved.kind !== 'ai' || resolved.streaming) return;
    const body = resolved.text.trim();
    if (!body || placedAiTextRef.current === body) return;
    placedAiTextRef.current = body;
    arRef.current?.placeCardsOnly(
      0.5,
      0.85,
      buildArCards(resolved.label ?? null, body),
    );
    setArCardShown(true); // AR cards now anchored → hide the on-screen card
  }, [allowUngrounded, resolved]);

  // __DEV__ DIRECT-GLB RENDER TEST — no scan, no recognition.
  //
  // When a devDirectGlb URL is supplied (only from the dev Health-Check board),
  // wait until ARCore is TRACKING, run the URL through the SAME production cache
  // path (getOrFetchGlb → file:// on the device), set it as the model, and call
  // the native placeInFront() to anchor it ~1.2 m ahead of the camera. Native
  // defers the actual placement until BOTH the glbUri prop and TRACKING are
  // satisfied (tryPlacePending), so the prop update and the command can race
  // freely. Fires once (directPlacedRef).
  //
  // ADMIN-HARNESS (REMOVE AFTER KONARK) — was `!__DEV__`, which made this body
  // dead in release and therefore untestable on a release build. The Phase 0
  // skeletal-animation probe has to run under R8 (a debug-only dependency has
  // caused a production failure on this codebase before), so the gate now also
  // admits `showAdminHarness` — the same isAdminUser() allowlist that already
  // guards devDirectGlb itself above and depthArmed/geospatialEnabled below.
  // Still fully inert for normal users: devDirectGlb is null unless the admin
  // health board launched this screen.
  useEffect(() => {
    if ((!__DEV__ && !showAdminHarness) || !devDirectGlb) return;
    // Cloud Anchor RESOLVE mode must NOT auto-place — the model's pose comes
    // from the resolved anchor, not from placeInFront. (HOST mode keeps the
    // auto-place: it hosts the anchor this effect creates.)
    if (devCloudAnchor === 'resolve') return;
    if (!tracking || directPlacedRef.current) return;
    // WAIT FOR A PLANE, not merely for TRACKING.
    //
    // ARCore reports TRACKING within about a second of the camera opening, but a
    // usable horizontal plane needs several more seconds of parallax. Firing on
    // TRACKING meant placeInFront() ran before any plane existed, fell through its
    // whole ladder to the free-space tier, and anchored the model 1.2 m ahead at
    // CAMERA height — which for a figure whose origin is its feet put it standing
    // on the viewer's eye line. Logged as:
    //   "no tracked plane at all — free-space fallback (trueScale=false, y=-0.11
    //    vs camera 0.16)"
    //
    // Waiting lets the plane-hit tier win, so the figure lands on the real floor.
    // The timeout is the escape hatch: a dark or featureless room may never yield
    // a plane, and placing badly beats never placing at all in a dev harness.
    // Wait only for the short depth warm-up. planeReady can no longer become true at
  // all for a figure - plane detection is switched off natively once one is armed - so
  // gating on it would block placement forever.
  // GATE PROBE. A silent early return here means no GLB is ever fetched, so every tap
  // is then rejected by preflight() with no log at all - which is exactly the "nothing
  // happens, it just says it is looking for a floor" symptom. Print the gate state so
  // the blocker names itself instead of being deduced.
  console.log(
    `[PHASE3] autoplace gate: tracking=${tracking} waitExpired=${
      planeWaitExpiredRef.current
    } placed=${directPlacedRef.current} planeReady=${planeReady} glb=${!!devDirectGlb}`,
  );
  if (!planeWaitExpiredRef.current) return;
    directPlacedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const uri = await getOrFetchGlb(devDirectGlb);
        if (cancelled) return;
        setGlbUri(uri);
        arRef.current?.placeInFront();
        setStatus(prev => (prev === 'placed' ? prev : 'ready'));
      } catch {
        directPlacedRef.current = false; // allow a retry on the next tracking tick
        setErrorMessage('Direct GLB load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [devDirectGlb, devCloudAnchor, tracking, showAdminHarness, planeReady, planeWaitExpired]);

  // Escape hatch for the plane wait above: after PLANE_WAIT_MS of tracking with no
  // plane, place anyway. Re-runs the effect by flipping state, not just the ref.
  useEffect(() => {
    if ((!__DEV__ && !showAdminHarness) || !devDirectGlb) return;
    if (!tracking || directPlacedRef.current) return;
    console.log('[PHASE3] depth warm-up timer armed');
    const timer = setTimeout(() => {
      planeWaitExpiredRef.current = true;
      setPlaneWaitExpired(true);
    }, PLANE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [devDirectGlb, tracking, planeReady, showAdminHarness]);

  // __DEV__ CLOUD ANCHOR RESOLVE MODE — arm the test model WITHOUT placing it.
  //
  // The GLB runs through the same production cache path and is set as the
  // glbUri prop only; the native side attaches it to the anchor returned by
  // resolveCloudAnchor (immediately if the prop already landed, else via the
  // setGlbUri progressive-swap branch when the download finishes). Fully inert
  // in release: devCloudAnchor is constant-folded to null.
  useEffect(() => {
    if (!__DEV__ || devCloudAnchor !== 'resolve' || !devDirectGlb) return;
    if (resolveGlbArmedRef.current) return;
    resolveGlbArmedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const uri = await getOrFetchGlb(devDirectGlb);
        if (cancelled) return;
        setGlbUri(uri);
      } catch {
        resolveGlbArmedRef.current = false;
        setErrorMessage('Direct GLB load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [devCloudAnchor, devDirectGlb]);

  return (
    <View style={styles.root}>
      <EpocheyeDetectARView
        ref={arRef}
        style={StyleSheet.absoluteFill}
        glbUri={glbUri ?? undefined}
        modelScale={
          devDirectGlb
            ? devGlbScaleM ?? DIRECT_GLB_TEST_SCALE_M
            : undefined
        }
        groundAnchored={devGroundAnchored || undefined}
        walkSpeedMps={devWalkSpeed || undefined}
        walkDistanceM={devWalkDistance || undefined}
        animationClip={devAnimationClip ?? undefined}
        onModelAnimations={devDirectGlb ? handleModelAnimations : undefined}
        // UNGATED. The dev HUD still only reads this behind devDirectGlb, but the
        // burst also carries luma, plane count and fps — the lighting and
        // trackability of the actual room — and gating the SUBSCRIPTION on a
        // developer flag meant no visit ever recorded any of it.
        onFrameStats={e => {
          siteTelemetry.sampleFrameStats(e);
          if (devDirectGlb) setFrameStats(e);
        }}
        onFigureGeometry={devDirectGlb ? setFigure : undefined}
        cardData={
          resolved.kind === 'grounded' ? JSON.stringify(resolved.card) : undefined
        }
        cloudAnchorsEnabled={devCloudAnchor != null}
        depthArmed={showAdminHarness} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        depthOcclusionEnabled={occlusionOn} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        geospatialEnabled={geoActive} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        onReady={handleReady}
        onTrackingState={state => {
          handleTrackingState(state);
          arHealth.onTrackingState(state);
        }}
        onTrackingFailure={arHealth.onTrackingFailure}
        onThermalStatus={arHealth.onThermalStatus}
        onPlaneDetected={handlePlaneDetected}
        onAnchorPlaced={handleAnchorPlaced}
        onError={handleError}
        onFrameCaptured={handleFrameCaptured}
        onCloudAnchorEvent={devCloudAnchor ? handleCloudAnchorEvent : undefined}
        onVpsResult={showAdminHarness ? setVpsResult : undefined} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        onGeospatialState={e => {
          // Accuracies only, never the coordinates. This is the direct evidence
          // for whether a world-locked anchor could ever resolve at this site.
          siteTelemetry.sampleGeoAccuracy(e);
          if (showAdminHarness) setGeoState(e);
        }}
      />

      {/* TAP THE FLOOR TO PLACE HIM.
          The viewer knows where the ground is; the app does not. Auto-placement has to
          assume a floor height (EYE_HEIGHT_M below the phone) whenever ARCore has no
          plane — and ARCore cannot get a plane from someone standing still, because
          plane detection needs the parallax of walking. That assumption is what put the
          figure overhead whenever the phone was held above 1.5 m.
          A tap removes the guess entirely: it hit-tests exactly where the finger
          landed, against depth, planes or instant placement, whichever answers first.
          It is also the AR placement gesture people already know from every other app.
          Auto-place still runs as a fallback so the screen is never empty. */}
      {devDirectGlb ? (
        <Pressable
          style={styles.tapToPlace}
          onPress={(e) => {
            const {locationX, locationY} = e.nativeEvent;
            arRef.current?.placeAtScreenPoint(locationX, locationY);
            setStatus(prev => (prev === 'placed' ? prev : 'ready'));
            console.log(
              `[PHASE3] tap-to-place at ${locationX.toFixed(0)},${locationY.toFixed(0)}`,
            );
          }}
        />
      ) : null}

      {/* AIM COACH.
          Deliberately large, centred and sparse: this fires when the visitor is not
          looking at the right thing, so it has to be readable without hunting for it.
          The arrow points the SHORT way round (native sends a signed bearing), because
          telling someone to turn the long way is worse than saying nothing. */}
      {coaching.message ? (
        <View pointerEvents="none" style={styles.aimCoach}>
          <Text style={styles.aimCoachText}>
            {coaching.arrow === 'left' ? '←  ' : ''}
            {coaching.message}
            {coaching.arrow === 'right' ? '  →' : ''}
          </Text>
        </View>
      ) : null}

      {/* Voice for the speaking figure.
          Audio-only, so it is deliberately given no size and no controls — this is
          a man talking, not a media player. `paused` waits for the AR notice so the
          voice cannot start over a safety screen the visitor has not accepted yet.
          `react-native-video` is already a dependency; AudioPlayer.tsx is NOT reused
          because it ships a full scrub-bar UI meant for a listening screen. */}
      {devAudioUri ? (
        <Video
          source={{uri: devAudioUri}}
          paused={!activationDone || coaching.pauseNarration}
          repeat={false}
          ignoreSilentSwitch="ignore"
          onError={(e: unknown) => {
            console.warn('[PHASE3] figure audio failed', e);
            setErrorMessage('voice failed to load');
          }}
          onEnd={() => console.log('[PHASE3] figure audio finished')}
          style={styles.hiddenAudio}
        />
      ) : null}

      <ARActivationOverlay
        visible={!activationDone}
        onDone={() => setActivationDone(true)}
      />

      <ScanGuideOverlay phase={scanPhase} ready={tracking} />

      {isOffline ? <OfflineScanOverlay /> : null}
      {/* Live AR health, in plain words. Until now this screen showed the raw ARCore
          enum in the message bubble and had no idea the phone was throttling at all. */}
      <ArSessionBanner
        health={arHealth}
        onRetry={() => {
          arHealth.reset();
          setErrorMessage(null);
        }}
      />

      {devDisclosure && activationDone ? (
        <View style={styles.disclosureBanner} pointerEvents="none">
          <Text style={styles.disclosureText}>{devDisclosure}</Text>
        </View>
      ) : null}

      {/* PHASE 0 — skeletal-animation verdict, on-screen. This test is run at
          arm's length in a room with the phone held up; a Metro-only readout
          would be unreadable exactly when it is needed. Shown only for the
          direct-GLB harness, so it never appears in a real scan. */}
      {devDirectGlb && (modelAnimations || frameStats) ? (
        <View style={styles.animProbeBanner} pointerEvents="none">
          {figure ? (
            <Text style={styles.animProbeBody}>
              {`feet ${figure.feetY.toFixed(2)} · head ${figure.headY.toFixed(
                2,
              )} · cam ${figure.camY.toFixed(2)}
feet vs you ${(
                figure.feetY - figure.camY
              ).toFixed(2)} m ${
                figure.feetY - figure.camY > 0 ? '← ABOVE YOU' : '(below, ok)'
              } · walked ${figure.walked.toFixed(2)} m`}
            </Text>
          ) : null}
          {frameStats ? (
            <Text style={styles.animProbeBody}>
              {`${frameStats.meanMs.toFixed(1)} ms mean · ${frameStats.p95Ms.toFixed(
                1,
              )} ms p95 · ${frameStats.fps.toFixed(
                1,
              )} fps · animated=${frameStats.animated ? 'yes' : 'no'}
planes=${frameStats.planes} · why=${frameStats.trackingWhy}${
                frameStats.torch ? ' · lamp ON' : ''
              }`}
            </Text>
          ) : null}
          {/* What ARCore is doing, in words. A correct grid pipeline with zero
              planes looks exactly like a broken one, and a whole night was lost
              to that ambiguity. planes=0 is "still scanning"; a non-NONE reason is
              ARCore saying the ROOM is the problem, which no code can fix. */}
          {/* Only speak up when ARCore itself reports a problem. planes===0 used to
              drive this, but plane detection is deliberately DISABLED for the figure
              now - placement is depth-based - so a zero plane count is the expected
              state and saying "scanning for the floor" about it would be a lie. */}
          {frameStats &&
          frameStats.trackingWhy !== 'NONE' &&
          frameStats.trackingWhy !== '' ? (
            <Text style={styles.animProbeTitle}>
              {trackingHint(frameStats.trackingWhy, frameStats.torch)}
            </Text>
          ) : null}
          {modelAnimations ? (
            <>
              <Text style={styles.animProbeTitle}>
                {modelAnimations.count > 0
                  ? `PHASE 0 — ${modelAnimations.count} CLIP${
                      modelAnimations.count === 1 ? '' : 'S'
                    } FOUND`
                  : 'PHASE 0 — NO CLIPS ON THIS MODEL'}
              </Text>
              <Text style={styles.animProbeBody}>
                {modelAnimations.count > 0
                  ? modelAnimations.names
                      .map(
                        (n, i) =>
                          `${i}: ${n || '(unnamed)'} · ${(
                            modelAnimations.durations[i] ?? 0
                          ).toFixed(2)}s`,
                      )
                      .join('\n')
                  : 'Skeleton absent or stripped by the loader.'}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {/* ADMIN-HARNESS (REMOVE AFTER KONARK) — mode-less on the plain scan screen
          (VPS + occlusion toggle); 'host'/'resolve' when launched from the board. */}
      {showAdminHarness ? (
        <DevCloudAnchorOverlay
          mode={devCloudAnchor ?? undefined}
          tracking={tracking}
          placed={status === 'placed'}
          lastEvent={cloudAnchorEvent}
          onHost={ttlDays => arRef.current?.hostCloudAnchor(ttlDays)}
          onResolve={id => arRef.current?.resolveCloudAnchor(id)}
          onCheckVps={() => {
            // Probe VPS at wherever the user is now: reuse the app's live GPS fix
            // (usePlacesStore.currentLocation), priming tracking if it hasn't
            // fired yet. Falls back to a warn log if no fix is available.
            void (async () => {
              const places = usePlacesStore.getState();
              let loc = places.currentLocation;
              if (!loc) {
                await places.ensureLocationTracking();
                loc = usePlacesStore.getState().currentLocation;
              }
              if (!loc) {
                console.warn(
                  '[VPS] no GPS fix yet — wait for location (go outdoors), then retry',
                );
                return;
              }
              arRef.current?.checkVps(loc.latitude, loc.longitude);
            })();
          }}
          depthOcclusion={occlusionOn}
          onToggleDepthOcclusion={setOcclusionOn}
          geospatial={geoActive}
          onToggleGeospatial={handleToggleGeospatial}
          vpsResult={vpsResult}
          geoState={geoState}
        />
      ) : null}

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              {allowUngrounded ? 'DEV · Scan anything' : t('lens.scanArtifact')}
            </Text>
            <Text style={styles.subtitle}>
              {`${tracking ? t('lens.stateTracking') : t('lens.stateScanning')} · ${t('lens.worldAnchored')}`}
            </Text>
          </View>
          {/* Cloud Anchor harness: Reset detaches the very anchor a host is
              mapping (and dead-ends the fire-once auto-place), so it is hidden
              in that dev mode — relaunch from the health board instead. */}
          {!devCloudAnchor ? (
            <Pressable
              onPress={handleReset}
              hitSlop={12}
              style={[styles.iconButton, status !== 'placed' && styles.iconButtonDisabled]}>
              <RefreshCcw
                size={16}
                color={status === 'placed' ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
              />
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>
        {remaining != null ? (
          <View style={styles.scansPill} pointerEvents="none">
            <Text style={styles.scansPillText}>
              {t('lens.scansLeft', {count: remaining})}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        {resolved.kind === 'grounded' && !arCardShown && cardReady && (
          <View style={styles.cardWrap}>
            <GroundedObjectCard card={resolved.card} minimal={resolved.minimal} />
          </View>
        )}
        {resolved.kind === 'ai' && !arCardShown && cardReady && (
          <View style={styles.cardWrap}>
            <AiGuessCard
              label={resolved.label}
              text={resolved.text}
              streaming={resolved.streaming}
            />
          </View>
        )}

        {/* The ScanGuideOverlay owns the aiming/scanning/miss cues; this bubble is
            reserved for actionable errors/gates and the post-placement hint. */}
        {(errorMessage || status === 'placed') && (
          <View
            style={[styles.messageBubble, status === 'error' && styles.bubbleError]}
            pointerEvents="none">
            <Text style={styles.messageText}>
              {errorMessage ?? t('lens.hintPlaced')}
            </Text>
          </View>
        )}

        <View style={styles.buttonRow} pointerEvents="box-none">
          {/* Cloud Anchor harness: a Detect scan re-places/clears the anchor
              being hosted (and can navigate to the paywall), so the scan
              button is hidden in that dev mode — the overlay drives the flow. */}
          {!devCloudAnchor && (
            <Pressable
              onPress={handleDetect}
              disabled={detecting || isOffline}
              style={[
                styles.detectButton,
                (detecting || isOffline) && styles.detectButtonBusy,
              ]}>
              {detecting ? (
                <ActivityIndicator color="#1A0F00" />
              ) : (
                <>
                  <ScanSearch size={18} color="#1A0F00" />
                  <Text style={styles.detectButtonText}>{t('lens.detect')}</Text>
                </>
              )}
            </Pressable>
          )}
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
  const {t} = useTranslation();
  // Same as the native path: block scanning, keep the camera session alive.
  const {isOffline} = useNetwork();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const cameraRef = useRef<VisionCamera | null>(null);
  const device = useCameraDevice('back');
  const [activationDone, setActivationDone] = useState(false);

  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const {resolved, runResolution, remaining} = useDetectionResolver(
    venueSlug,
    allowUngrounded,
  );
  const {scanPhase, cardReady, resolveScan} = useScanPhase(busy);

  const handleDetect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    analytics.track('scan_started', {venue: venueSlug, mode: '2d'});
    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo?.path) {
        resolveScan('error'); // capture failed → miss cue
        setMessage(t('lens.captureFailed'));
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
      if (resolution.kind === 'aborted') return; // scan cancelled — leave UI as-is
      resolveScan(resolution.kind); // drive the overlay lock-on / miss cue
      if (resolution.kind === 'paywall') {
        navigation.navigate(ROUTES.MAIN.PURCHASE, {preSelectedPlaceId: venueSlug});
      } else if (resolution.kind === 'limit') {
        setMessage(t('lens.dailyLimit'));
      } else if (resolution.kind === 'rejected') {
        setMessage(resolution.message ?? t('lens.statueGate'));
      } else if (resolution.kind === 'error') {
        setMessage(
          __DEV__ && resolution.message
            ? `Lens error — ${resolution.message}`
            : t('lens.identifyFailed'),
        );
      } else {
        setMessage(null);
        void maybePromptShare(allowUngrounded, setShareOpen);
      }
    } catch {
      resolveScan('error'); // frame prep failed → miss cue
      setMessage(t('lens.detectionFailed'));
    } finally {
      setBusy(false);
    }
  }, [busy, runResolution, resolveScan, navigation, venueSlug, allowUngrounded, t]);

  if (!device) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.fallbackBlock}>
          <Text style={styles.fallbackHeading}>{t('lens.noCamera')}</Text>
          <Pressable onPress={onClose} style={styles.fallbackButton}>
            <Text style={styles.fallbackButtonText}>{t('lens.close')}</Text>
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

      <ARActivationOverlay
        visible={!!device && !activationDone}
        onDone={() => setActivationDone(true)}
      />

      <ScanGuideOverlay phase={scanPhase} />

      {isOffline ? <OfflineScanOverlay /> : null}

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconButton}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              {allowUngrounded ? 'DEV · Scan anything' : t('lens.scanArtifact')}
            </Text>
            <Text style={styles.subtitle}>{t('lens.subtitle2d')}</Text>
          </View>
          <View style={styles.iconButton} />
        </View>
        {remaining != null ? (
          <View style={styles.scansPill} pointerEvents="none">
            <Text style={styles.scansPillText}>
              {t('lens.scansLeft', {count: remaining})}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.arNotice} pointerEvents="none">
          <Text style={styles.arNoticeText}>{t('lens.noArNotice')}</Text>
        </View>

        {resolved.kind === 'grounded' && cardReady && (
          <View style={styles.cardWrap}>
            <GroundedObjectCard card={resolved.card} minimal={resolved.minimal} />
          </View>
        )}
        {resolved.kind === 'ai' && cardReady && (
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
          disabled={busy || isOffline}
          style={[
            styles.detectButton,
            (busy || isOffline) && styles.detectButtonBusy,
          ]}>
          {busy ? (
            <ActivityIndicator color="#1A0F00" />
          ) : (
            <>
              <ScanSearch size={18} color="#1A0F00" />
              <Text style={styles.detectButtonText}>{t('lens.detect')}</Text>
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

/**
 * Offline cue for the scan screen. Recognition posts a frame to the backend, so
 * it cannot run without a connection — but the camera session stays MOUNTED and
 * active behind this overlay. Tearing a vision-camera session down on a
 * connectivity blip is exactly the unmount-on-offline behaviour the app moved
 * away from, and it is the class of bug that produced the MapView crash.
 *
 * box-none so the close button and the (disabled) scan button underneath stay
 * reachable — going offline must never trap the user in the camera.
 */
const OfflineScanOverlay: React.FC = () => {
  const {t} = useTranslation();
  return (
    <View style={styles.offlineScanOverlay} pointerEvents="box-none">
      <OfflineInline message={t('offline.scanMessage')} />
    </View>
  );
};

const styles = StyleSheet.create({
  offlineScanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.72)',
  },
  root: {flex: 1, backgroundColor: '#000000'},
  noArBackdrop: {backgroundColor: '#0A0A0A'},
  topOverlay: {position: 'absolute', top: 0, left: 0, right: 0},
  // Audio-only: zero-size and non-interactive, never seen.
  hiddenAudio: {width: 0, height: 0, opacity: 0},
  // The on-screen honesty line. Deliberately NOT styled like the debug readouts:
  // this is content the visitor is meant to read, so it sits low, stays quiet, and
  // uses the warm-white body colour rather than the harness amber. Solid backing
  // because it has to stay legible against a bright daylight camera feed.
  disclosureBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  disclosureText: {
    color: '#F5F0E8',
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  // Full-bleed tap target for placing the figure. Sits UNDER every control (it is
  // rendered before them) so buttons still win, and above the camera feed so a tap
  // anywhere on the floor lands here.
  tapToPlace: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  // PHASE 0 skeletal-animation probe readout. Sits low so it never covers the
  // figure being judged. Monospace so clip indices line up when read at a glance.
  animProbeBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 132,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderColor: 'rgba(203,168,98,0.55)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aimCoach: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '42%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  aimCoachText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  animProbeTitle: {
    color: '#E8A020',
    fontSize: 12,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  animProbeBody: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'monospace',
  },
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
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: 'PlusJakartaSans-Regular',
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
    fontFamily: 'PlusJakartaSans-Medium',
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
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  messageText: {
    fontFamily: 'PlusJakartaSans-Medium',
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
    borderColor: 'rgba(203,168,98,0.45)',
  },
  pickerChipActive: {backgroundColor: AMBER, borderColor: AMBER},
  pickerChipText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
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
    fontFamily: 'PlusJakartaSans-SemiBold',
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
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  fallbackBody: {
    fontFamily: 'PlusJakartaSans-Regular',
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
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 13,
    color: '#1A0F00',
  },
  fallbackDismiss: {
    marginTop: 18,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});

export default DetectArScreen;
