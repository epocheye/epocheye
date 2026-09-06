/**
 * PointLearnStep — step 4 of the journey. Point the camera at a pillar, an
 * arch, a painted wall; tap the shutter; the venue's recognition answers; the
 * answer is hung in the world where the visitor taps.
 *
 * Recognition is the SAME client path DetectArScreen uses — captureFrame() on
 * the native view, prepareImageForGemini(), then recognize() (submit + poll of
 * /recognize/result) and, for a grounded class, fetchObjectCard(). The result
 * becomes card JSON in the shape the native renderer reads and is placed with
 * placeCardsAtScreenPoint at the visitor's tap: depth hit-test at the point,
 * then a tracked plane, then ahead of the camera, then headlocked — always in
 * world space, never a flat on-screen card (hard rule 1).
 *
 * A card carrying `video_url` renders as a video playing ON the placard; its tap
 * arrives on onCardTap and opens the full-screen player. Until real card video
 * exists, a dev-only hook attaches the CloudFront test pattern when the
 * recognised title names a pillar (see journeyCards.withVideoCards). It is
 * inert in release builds: JOURNEY_TEST_VIDEO_URL is null there.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Camera, Sparkles } from 'lucide-react-native';

import EpocheyeDetectARView, {
  type CardTapEvent,
  type EpocheyeDetectARHandle,
} from '../../../native/EpocheyeDetectARView';
import ARActivationOverlay from '../../../components/ui/ARActivationOverlay';
import ArSessionBanner from '../../../components/ui/ArSessionBanner';
import { useUserStore } from '../../../stores/userStore';
import { isAdminUser } from '../../../shared/auth/isAdminUser';
import { useArSessionHealth } from '../../../shared/hooks/useArSessionHealth';
import { prepareImageForGemini } from '../../../services/geminiVisionService';
import { recognize } from '../../../services/recognizeService';
import { fetchObjectCard } from '../../../services/detectorResolver';
import {
  JOURNEY_TEST_VIDEO_URL,
  buildMediaUrl,
  getOrFetchMedia,
} from '../../../services/mediaCache';
import { listObjectMedia } from '../../../utils/api/objects';
import { analytics } from '../../../services/analytics';
import { ROUTES } from '../../../core/constants';
import type { MainStackParamList } from '../../../core/types/navigation.types';
import { siteTelemetry } from '../../../services/siteTelemetry';
import {
  buildAiCards,
  buildGroundedCards,
  titleMentionsPillar,
  withVideoCards,
  type VideoCardSpec,
  type ArCard,
} from './journeyCards';
import {
  CameraGate,
  GhostButton,
  JOURNEY_GOLD,
  JOURNEY_INK,
  PrimaryButton,
  StatusPill,
  journeyStyles,
} from './JourneyUi';

/**
 *  idle → identifying (frame in flight) → awaitTap (cards ready, where?) →
 *  placing (native anchoring) → placed → idle again on "Scan something else".
 */
type Phase = 'idle' | 'identifying' | 'awaitTap' | 'placing' | 'placed';

/**
 * Native normally reports onAnchorPlaced for cards (it falls through to a
 * headlocked placement rather than placing nothing); this is the belt to that
 * brace so the panel can never sit on "Placing…" forever. It is NOT a licence to
 * claim success: the two paths that give up without placing anything
 * (cardNodes.isEmpty() in doPlaceCards / doPlaceCardsHeadlocked) announce
 * themselves on onARError, and handleArError cancels this timer rather than
 * letting it promote the step to "placed" with nothing in the world.
 */
const PLACE_SETTLE_MS = 6000;

/**
 * How long to wait for native to answer captureFrame() before assuming it never
 * will.
 *
 * captureFrame has three exits that emit ONLY onARError and never
 * onFrameCaptured — no AR frame yet, an unexpected camera image format, and any
 * throw out of acquireCameraImage() (NotYetAvailableException and
 * DeadlineExceededException are both routine when the previous image is still
 * held). Without this the step sat on "Looking closely…" with the shutter
 * disabled and "Scan something else" hidden, i.e. one dropped camera frame ended
 * point-and-learn. The guard only fires while nothing is actually in flight (see
 * the `!abortRef.current` test), so a slow recognise is never cut short.
 */
const CAPTURE_WATCHDOG_MS = 4000;

interface Props {
  slug: string;
  arCapable: boolean;
  cameraGranted: boolean;
  onRequestCamera: () => void;
  /** A video card was tapped — open it full screen. */
  onOpenVideo: (uri: string, poster?: string) => void;
  onFinish: () => void;
}

const PointLearnStep: React.FC<Props> = ({
  slug,
  arCapable,
  cameraGranted,
  onRequestCamera,
  onOpenVideo,
  onFinish,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const arRef = useRef<EpocheyeDetectARHandle>(null);

  // OFF-SITE SCANNING, FOR ADMINS ONLY.
  //
  // Point-and-learn is venue-scoped by design: the identifier is asked "which part of
  // Tipu Sultan's Summer Palace is this?", so 5 km away in an office every scan is
  // correctly refused as out_of_scope. Honest, and untestable anywhere but the palace.
  //
  // `allowUngrounded` is the escape hatch that ALREADY EXISTS for the same problem on
  // DetectArScreen's dev "scan anything": the backend runs the agent without the venue
  // gate. It needs no new endpoint, no migration and no deploy.
  //
  // TWO INDEPENDENT GATES, deliberately. This flag only asks; the server decides —
  // `handler.go` honours it solely when `middleware.IsAdminFromContext(ctx)` agrees, so
  // a tampered client gets nothing. That mirrors how admin already works elsewhere in
  // this codebase (the allowlist reveals the UI, the JWT's is_admin authorises it).
  const email = useUserStore(st => st.profile?.email);
  const scanUnscoped = isAdminUser(email);

  // Live AR health. Tracking failures no longer arrive on onError as a raw ARCore
  // enum, so handleArError below is left to genuine capture/placement faults — which
  // matters here, because those exits are load-bearing: captureFrame has three paths
  // that emit ONLY onError, and handleArError is what cancels the capture watchdog.
  const arHealth = useArSessionHealth();

  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const [message, setMessage] = useState<string | null>(null);
  const [placedTitle, setPlacedTitle] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const trackingRef = useRef(false);
  useEffect(() => {
    trackingRef.current = tracking;
  }, [tracking]);
  const [activationDone, setActivationDone] = useState(false);
  const [arError, setArError] = useState<string | null>(null);

  // Cards waiting for the visitor to say where they go.
  const pendingCardsRef = useRef<{ json: string; title: string } | null>(null);
  // Aborts an in-flight submit/poll so leaving the step never leaves the
  // up-to-45 s poll loop running in the background.
  const abortRef = useRef<AbortController | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCaptureTimer = useCallback(() => {
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }
  }, []);
  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    },
    [],
  );

  const handleShutter = useCallback(() => {
    // FIELD LOG. This step wrote only to analytics, which never reaches logcat, so
    // when a scan produced nothing there was no way to tell whether the shutter was
    // even accepted. That blindness cost three rounds on the lawn; it does not get
    // to cost three more here.
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'placed') {
      console.log(`[journey] shutter ignored phase=${phaseRef.current}`);
      return;
    }
    if (!trackingRef.current) {
      console.log('[journey] shutter refused - ARCore not tracking');
      setMessage(t('journey.explore.holdSteady'));
      return;
    }
    console.log('[journey] shutter pressed -> capturing frame');
    setMessage(null);
    setPhase('identifying');
    analytics.track('journey_scan_started', { slug });
    arRef.current?.captureFrame();
    clearCaptureTimer();
    captureTimerRef.current = setTimeout(() => {
      captureTimerRef.current = null;
      // Still waiting on the frame AND nothing in flight → native dropped it.
      if (phaseRef.current === 'identifying' && !abortRef.current) {
        setPhase('idle');
        setMessage(t('journey.explore.captureFailed'));
      }
    }, CAPTURE_WATCHDOG_MS);
  }, [slug, t, clearCaptureTimer]);

  const handleFrameCaptured = useCallback(
    async (uri: string) => {
      // Native answered — the watchdog has nothing left to guard.
      clearCaptureTimer();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const fail = (line: string) => {
        setPhase('idle');
        setMessage(line);
      };
      try {
        const base64 = await prepareImageForGemini(uri);
        console.log(
          `[journey] frame captured, ${Math.round(base64.length / 1024)} KB b64 -> POST /recognize venue=${slug}`,
        );
        const started = Date.now();
        const result = await recognize(
          { imageBase64: base64, venueId: slug, allowUngrounded: scanUnscoped },
          controller.signal,
        );
        if (controller.signal.aborted) {
          console.log('[journey] recognize aborted (visitor moved on)');
          return;
        }
        // match + tier is the whole diagnosis: 'out_of_scope'+'gate' means
        // ExploreGate refused the frame; 'out_of_venue' means the venue is not
        // seeded; a grounded/ai_interpretation with an empty body is a content gap.
        console.log(
          `[journey] recognize match=${result.match} tier=${result.tier ?? '-'} ` +
            `class=${result.class_id ?? '-'} in ${Date.now() - started}ms ` +
            `msg=${JSON.stringify(result.message ?? '')}`,
        );
        analytics.track('journey_scan_result', {
          slug,
          match: result.match,
          class_id: result.class_id,
        });

        // Free scans spent at this site → the existing Explorer-Pass purchase
        // flow (what DetectArScreen does), with a calm line left behind.
        if (result.match === 'paywall') {
          fail(t('journey.explore.paywall'));
          navigation.navigate(ROUTES.MAIN.PURCHASE, { preSelectedPlaceId: slug });
          return;
        }
        if (result.match === 'daily_limit') {
          fail(t('journey.explore.limit'));
          return;
        }
        // out_of_scope is the ONE refusal the backend writes for the visitor to
        // read verbatim, and explore mode authors two deliberately different ones:
        // the gate's "point at a part of the building" (they aimed at sky, lawn or
        // a friend) and the closer's "move closer to one feature". Collapsing both
        // into "try a clearer view, a little closer" hands the first case advice
        // that cannot work. Keep the i18n line only as the empty-message fallback.
        if (result.match === 'out_of_scope') {
          fail(result.message?.trim() || t('journey.explore.rejected'));
          return;
        }
        // The venue itself is not answering — the site was switched off
        // (recognition_enabled=false), the explore mode is not applied yet, or the
        // seeded-venue lookup errored. Without this the visitor read a venue-level
        // outage as a per-object gap ("Nothing to tell you about that one yet") and
        // kept scanning. The backend sends no message for this match, so the string
        // is load-bearing.
        if (result.match === 'out_of_venue') {
          fail(result.message?.trim() || t('journey.explore.notHere'));
          return;
        }

        // Grounded: the monument_objects row is the card (same lookup as the
        // Lens). A grounded match whose row is not servable falls through to
        // the agent's own card so the visitor still gets an answer.
        let cards: ArCard[] | null = null;
        let title = '';
        if (result.match === 'grounded' && result.class_id) {
          try {
            const card = await fetchObjectCard(result.class_id);
            if (controller.signal.aborted) return;
            if (card) {
              cards = buildGroundedCards(card);
              title = card.display_name;
            }
          } catch {
            // transport hiccup — use the agent's card below
          }
        }
        // A TITLE WITH NO BODY IS STILL AN ANSWER.
        //
        // exploreBody is empty whenever the row carries no knowledge_text, no
        // cultural_context and no story_hooks — a documented, tested state that a
        // rebuild through cardForClass (a cache row an admin corrected onto a barren
        // class) can still produce. Requiring `body` threw that card away AFTER the
        // scan had been charged and cached, and showed "Nothing to tell you about
        // that one yet." buildAiCards already emits a single title-only placard for
        // an empty body, which is world-anchored like every other card (hard rule 1).
        if (!cards && result.card && (result.card.body || result.card.title)) {
          title = result.card.title || t('lens.thisObject');
          cards = buildAiCards(title, result.card.body ?? '');
        }
        if (!cards) {
          fail(t('journey.explore.unknown'));
          return;
        }

        // REAL CARD MEDIA — ALL OF IT, not just the first row.
        //
        // object_media (migration 090) is the row the video card was always
        // waiting for; until it existed the only thing feeding the native
        // VideoNode path was a colour-bar test pattern matched on the word
        // "pillar".
        //
        // THIS USED TO BE `.find()`. One video per object, first in sort_order,
        // and every later row silently unreachable — migration 093 seeds two
        // each on the palace's sword and hilt, so half of what was authored
        // could never be seen. It carries the list now.
        //
        // Keyed on class_id, so it only fires for a result with a catalogued
        // object behind it. Failure is silent: a card with no video is the
        // normal case, not an error worth interrupting a visitor for.
        //
        // 'class' IS STILL THE RIGHT KIND HERE, AND IT RETURNS NOTHING TODAY.
        // Migration 094 replaced the single class_id binding with a
        // (subject_kind, subject_key) pair, and 095 moved the palace's five
        // clips onto 'stop' and 'figure' - so this query is empty at the
        // palace by construction, and prod currently holds FIVE object_media
        // rows in total, all of them the palace's, none of them 'class'.
        // Measured on 2026-09-04 so the next reader does not re-investigate it.
        //
        // It stays anyway. 'class' is the only binding that can work at an
        // explore-mode venue, where the key is minted at runtime from whatever
        // the recogniser called the object and therefore cannot be authored
        // ahead of time. The two authored kinds are read where they belong -
        // AudioGuideStep for 'stop', MagicWindowScreen for 'figure', both
        // through shared/hooks/useSubjectMedia. Cost of keeping this: one
        // request per successful recognition that returns {media: []}.
        let videos: VideoCardSpec[] = [];
        if (result.class_id) {
          const res = await listObjectMedia(slug, 'class', result.class_id);
          if (controller.signal.aborted) return;
          if (res.success) {
            const clips = res.data.media.filter(m => m.media_type === 'video');
            // Resolved together rather than in sequence. getOrFetchMedia never
            // rejects — it falls back to the remote URL — so one slow or absent
            // clip cannot hold up or fail the others.
            const resolved = await Promise.all(
              clips.map(async clip => {
                const url = buildMediaUrl(clip.media_url);
                if (!url) return null;
                // A GENERATED ASSET NEVER PLAYS WITHOUT ITS DISCLOSURE. The
                // database refuses to store one without it; this is the other
                // half of that promise. Checked PER CLIP, so a bad row is
                // dropped on its own instead of taking its siblings with it.
                const disclosure = clip.is_generated ? (clip.disclosure ?? '') : '';
                if (clip.is_generated && !disclosure) return null;
                const posterRemote = buildMediaUrl(clip.poster_url);
                const [videoUrl, posterUrl] = await Promise.all([
                  getOrFetchMedia(url),
                  posterRemote ? getOrFetchMedia(posterRemote) : Promise.resolve(null),
                ]);
                return {
                  videoUrl,
                  title: clip.title || title,
                  posterUrl,
                  disclosure,
                } as VideoCardSpec;
              }),
            );
            if (controller.signal.aborted) return;
            videos = resolved.filter((v): v is VideoCardSpec => v !== null);
          }
        }

        // DEV-ONLY FALLBACK, and only until real media is seeded: exercise the
        // video-card path on anything called a pillar. JOURNEY_TEST_VIDEO_URL is
        // null outside a dev build, so this is dead in release and flipping
        // JOURNEY_OPEN_TO_ALL cannot ship a test pattern onto a heritage pillar.
        if (videos.length === 0 && JOURNEY_TEST_VIDEO_URL && titleMentionsPillar(title)) {
          const devUrl = await getOrFetchMedia(JOURNEY_TEST_VIDEO_URL);
          if (controller.signal.aborted) return;
          videos = [{ videoUrl: devUrl, title }];
        }
        cards = withVideoCards(cards, videos, t('journey.explore.watch'));

        pendingCardsRef.current = { json: JSON.stringify(cards), title };
        setMessage(null);
        console.log('[journey] cards built -> awaiting the visitor tap to anchor');
        setPhase('awaitTap');
      } catch (err) {
        if (controller.signal.aborted) return;
        if (__DEV__) console.warn('[journey] recognize failed', err);
        analytics.track('journey_scan_error', { slug });
        fail(t('journey.explore.error'));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [slug, navigation, t, clearCaptureTimer, scanUnscoped],
  );

  // The visitor says where the card sits. dp coordinates straight from the
  // touch; native does the dp→px and the depth/plane/ahead/headlocked ladder.
  const handlePlaceTap = useCallback(
    (x: number, y: number) => {
      const pending = pendingCardsRef.current;
      if (!pending || phaseRef.current !== 'awaitTap') return;
      setPhase('placing');
      setPlacedTitle(pending.title);
      console.log(`[journey] placing cards at tap dp=(${Math.round(x)},${Math.round(y)})`);
      arRef.current?.placeCardsAtScreenPoint(x, y, pending.json);
      clearSettleTimer();
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        if (phaseRef.current === 'placing') setPhase('placed');
      }, PLACE_SETTLE_MS);
    },
    [clearSettleTimer],
  );

  const handleAnchorPlaced = useCallback(
    (label: string) => {
      if (phaseRef.current !== 'placing') return;
      clearSettleTimer();
      setPhase('placed');
      analytics.track('journey_card_placed', { slug, label });
    },
    [slug, clearSettleTimer],
  );

  const handleCardTap = useCallback(
    (e: CardTapEvent) => {
      if (!e.videoUrl) return;
      analytics.track('journey_card_video_opened', { slug, card: e.id });
      onOpenVideo(e.videoUrl, e.posterUrl);
    },
    [slug, onOpenVideo],
  );

  const handleScanAgain = useCallback(() => {
    abortRef.current?.abort();
    clearCaptureTimer();
    clearSettleTimer();
    pendingCardsRef.current = null;
    arRef.current?.clearAnchor();
    setPlacedTitle(null);
    setMessage(null);
    setPhase('idle');
  }, [clearCaptureTimer, clearSettleTimer]);

  const handleTrackingState = useCallback((state: string) => {
    setTracking(state === 'TRACKING');
  }, []);

  // Native emits '' when a tracking fault CLEARS — that is not a failure.
  //
  // A real one, though, has to move the step, not just tint the pill. Two phases
  // are waiting on a native callback that a failure path never sends:
  //   identifying — captureFrame() can exit on onARError alone (no frame, wrong
  //     image format, a throw out of acquireCameraImage), and nothing else would
  //     ever take the step off "Looking closely…".
  //   placing — doPlaceCards/doPlaceCardsHeadlocked post "could not render the
  //     card" and return WITHOUT onAnchorPlaced when no placard could be built, so
  //     the settle timer would otherwise announce a card that is not in the world.
  // The identifying branch is deliberately limited to the window before the
  // recognise request starts (abortRef is set as the first thing
  // handleFrameCaptured does), so a tracking blip mid-request can never bin a scan
  // the visitor has already paid for. Native itself stays quiet about tracking
  // faults while a placement is pending (onTrackingFailureChanged checks
  // pendingCards), so the placing branch only ever sees the placement's own errors.
  const handleArError = useCallback(
    (err: string) => {
      setArError(err ? err : null);
      if (!err) return;
      if (phaseRef.current === 'identifying' && !abortRef.current) {
        clearCaptureTimer();
        setPhase('idle');
        // The panel stays human; the raw native string is already in the pill for
        // anyone reading a bug report off the screen.
        setMessage(t('journey.explore.captureFailed'));
        return;
      }
      if (phaseRef.current === 'placing') {
        clearSettleTimer();
        pendingCardsRef.current = null;
        // Cancel any placement still pending inside native, so a card cannot
        // appear later against a panel that has already moved on.
        arRef.current?.clearAnchor();
        setPlacedTitle(null);
        setPhase('idle');
        setMessage(t('journey.explore.placeFailed'));
      }
    },
    [t, clearCaptureTimer, clearSettleTimer],
  );

  // ---- Copy ----
  let status: string | null = null;
  if (phase === 'identifying') status = t('journey.explore.identifying');
  else if (phase === 'awaitTap') status = t('journey.explore.tapToPlace');
  else if (phase === 'placing') status = t('journey.explore.placing');
  else if (arError) status = arError;

  const body =
    message ??
    (phase === 'placed'
      ? t('journey.explore.placed')
      : phase === 'awaitTap'
        ? t('journey.explore.tapToPlace')
        : t('journey.explore.hint'));

  if (!arCapable) {
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={[journeyStyles.page, journeyStyles.pageContent]}>
          <Text style={journeyStyles.eyebrow}>{t('journey.explore.eyebrow')}</Text>
          <Text style={journeyStyles.title}>{t('journey.explore.title')}</Text>
          <Text style={journeyStyles.body}>{t('journey.explore.needsAr')}</Text>
          <PrimaryButton
            label={t('journey.explore.finish')}
            icon={<Sparkles size={18} color={JOURNEY_INK} />}
            onPress={onFinish}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!cameraGranted) {
    return (
      <CameraGate
        onAllow={onRequestCamera}
        onSkip={onFinish}
        skipLabel={t('journey.explore.finish')}
      />
    );
  }

  const shutterEnabled = phase === 'idle' || phase === 'placed';

  return (
    <View style={journeyStyles.root}>
      <EpocheyeDetectARView
        ref={arRef}
        style={StyleSheet.absoluteFill}
        onTrackingState={state => {
          handleTrackingState(state);
          arHealth.onTrackingState(state);
        }}
        // The room's own lighting and trackability, recorded while the visitor
        // is standing in it. Nothing here identifies them.
        onFrameStats={siteTelemetry.sampleFrameStats}
        onTrackingFailure={arHealth.onTrackingFailure}
        onThermalStatus={arHealth.onThermalStatus}
        onAnchorPlaced={handleAnchorPlaced}
        onError={handleArError}
        onFrameCaptured={handleFrameCaptured}
        onCardTap={handleCardTap}
      />

      {/* Mounted ONLY while a card is waiting for its spot, so that afterwards a
          tap on the placard reaches native's own hit-test and nothing else. */}
      {phase === 'awaitTap' ? (
        <Pressable
          style={journeyStyles.tapLayer}
          accessibilityLabel={t('journey.explore.tapToPlace')}
          onPress={e => {
            const { locationX, locationY } = e.nativeEvent;
            handlePlaceTap(locationX, locationY);
          }}
        />
      ) : null}

      {status ? <StatusPill text={status} /> : null}

      {/* Retry here just forgets the fault and lets the visitor take another shot;
          there is nothing to re-place until they press the shutter again. */}
      <ArSessionBanner health={arHealth} onRetry={arHealth.reset} />

      <ARActivationOverlay
        visible={!activationDone}
        onDone={() => setActivationDone(true)}
        title={t('journey.steps.explore')}
      />

      <View style={journeyStyles.panel}>
        <Text style={journeyStyles.eyebrow}>{t('journey.explore.eyebrow')}</Text>
        <Text style={journeyStyles.title}>
          {phase === 'placed' && placedTitle ? placedTitle : t('journey.explore.title')}
        </Text>
        <Text style={journeyStyles.body}>{body}</Text>

        <View style={styles.controls}>
          {phase === 'awaitTap' || phase === 'placing' ? null : (
            <Pressable
              onPress={handleShutter}
              disabled={!shutterEnabled}
              accessibilityRole="button"
              accessibilityLabel={t('journey.explore.shutter')}
              accessibilityState={{ disabled: !shutterEnabled }}
              style={({ pressed }) => [
                styles.shutter,
                !shutterEnabled && styles.shutterDisabled,
                pressed && shutterEnabled && styles.pressed,
              ]}>
              <Camera size={28} color={JOURNEY_INK} />
            </Pressable>
          )}
          <View style={styles.sideButtons}>
            {phase !== 'idle' && phase !== 'identifying' ? (
              <GhostButton label={t('journey.explore.scanAgain')} onPress={handleScanAgain} />
            ) : null}
            <GhostButton
              label={t('journey.explore.finish')}
              icon={<Sparkles size={16} color={JOURNEY_GOLD} />}
              onPress={onFinish}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: JOURNEY_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(230,200,139,0.7)',
  },
  shutterDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  sideButtons: { flex: 1, gap: 8 },
});

export default PointLearnStep;
