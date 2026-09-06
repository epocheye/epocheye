/**
 * LawnStep — step 1 of the journey. On the lawn the host figure appears, turns
 * to the visitor and speaks the welcome; the media for the rest of the walk is
 * saved to the device while he talks.
 *
 * Mounts the native EpocheyeDetectARView directly with clean production props
 * (no dev params). Placement is the proven DetectArScreen recipe for a figure:
 * wait for TRACKING, give depth a short warm-up, then set glbUri and call
 * placeInFront() — native defers until model + tracking are both ready. Plane
 * finding is OFF for figures natively, so nothing here waits on a plane. A tap
 * anywhere on the feed re-places him at the finger (placeAtScreenPoint), the
 * gesture every AR app already teaches.
 *
 * The welcome is audio-only (a headless <Video>), paused until the figure is
 * placed and the activation overlay has cleared, so it can never start over a
 * screen the visitor has not seen. On a phone without AR he speaks without
 * appearing — the journey degrades, it never blocks.
 *
 * THIS STEP LEADS. The journey was sold as a guided walk — "the visitor is led
 * rather than left to wander" — so when the welcome ends the step hands the
 * visitor on by itself after one readable beat, instead of standing there
 * waiting for a tap. It was reported from the site as: the audio "arrived after
 * a delay, but when it finished, nothing happened". Two things caused that and
 * both are fixed here:
 *   - the step drove everything off `<Video onEnd>`, a callback Android can
 *     simply never send (see useAudioCompletion for the three shipped paths
 *     that stop the audio silently). Completion now comes from that hook, which
 *     answers the same question from four independent signals.
 *   - while he spoke, the only control on the panel read "Skip the welcome" —
 *     nobody presses "skip" after listening to the whole thing. Every state of
 *     this panel now carries a control that plainly moves forward.
 * The lead is never a shove: while the beat runs, "Stay a moment" and "Hear it
 * again" cancel it, and a cancelled hand-off never re-arms on its own.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tourFor } from '../../../features/magicwindow/tour';
import Video, { type VideoRef } from 'react-native-video';
import { Footprints, RotateCcw } from 'lucide-react-native';

import EpocheyeDetectARView, {
  type EpocheyeDetectARHandle,
} from '../../../native/EpocheyeDetectARView';
import ARActivationOverlay from '../../../components/ui/ARActivationOverlay';
import ArSessionBanner from '../../../components/ui/ArSessionBanner';
import { useArSessionHealth } from '../../../shared/hooks/useArSessionHealth';
import { resolveModelGlb } from '../../../services/glbSource';
import { getOrFetchMedia, type PrefetchSummary } from '../../../services/mediaCache';
import { analytics } from '../../../services/analytics';
import { COLORS } from '../../../core/constants/theme';
import {
  FIGURE_WARM_UP_MS,
  journeyWelcomeUrl,
  type JourneyHost,
} from './journeyConfig';
import {
  CameraGate,
  GhostButton,
  JOURNEY_GOLD,
  JOURNEY_INK,
  PrimaryButton,
  StatusPill,
  journeyStyles,
} from './JourneyUi';
import {
  useAudioCompletion,
  type AudioCompletionReason,
} from './useAudioCompletion';
import { useVisemeTrack } from './useVisemeTrack';
import { siteTelemetry } from '../../../services/siteTelemetry';

type VoiceState = 'idle' | 'speaking' | 'done' | 'failed';

/**
 * The hand-off — what happens after the welcome, however it ended.
 *
 * 'counting' is the readable beat before the journey moves on by itself.
 * 'cancelled' is the visitor saying "not yet"; it is TERMINAL, because a
 * hand-off that quietly re-armed itself after being cancelled would be a worse
 * betrayal than the freeze this replaces. Only a deliberate "Hear it again"
 * puts it back to 'none'. 'gone' means we have already called onContinue.
 */
type HandoffState = 'none' | 'counting' | 'cancelled' | 'gone';

/**
 * How long the panel holds after the welcome ends before walking the visitor to
 * the next step on its own.
 *
 * It has to happen without a tap: the owner's report was precisely that the
 * audio finished and "nothing happened... it did not move to the next step", on
 * a product whose promise is that he leads and you follow. But it cannot be
 * instant either — the panel swaps its line to say he is going inside and puts
 * a "Stay a moment" escape under it, and pulling the screen away before that
 * can be read would just trade one complaint for another. A second and a half
 * is one line of reading plus a thumb, and short enough that it never reads as
 * another stall.
 */
const WELCOME_HANDOFF_MS = 1500;

interface Props {
  slug: string;
  host: JourneyHost;
  /** World-locked AR can run on this phone (capability ready). */
  arCapable: boolean;
  /** Camera permission granted — only meaningful when `arCapable`. */
  cameraGranted: boolean;
  /** Re-ask for the camera (the visitor declined the first prompt). */
  onRequestCamera: () => void;
  /** Fired once, the moment the welcome starts — the screen begins pre-caching. */
  onSpeaking: () => void;
  /** Running pre-cache tally, for the quiet "saving" line. */
  prefetch: PrefetchSummary | null;
  /**
   * Open the world-locked reconstruction — the "See the reconstruction" button
   * that used to sit on SiteDetail.
   *
   * IT LIVES HERE BECAUSE IT ONLY MAKES SENSE HERE. It places authored viewing
   * stations against the real building, so the visitor has to be standing
   * outside looking at it — which is exactly what the arrival step is. Omitted
   * when the site has no stations, or when the phone cannot run world-locked
   * AR, so the control never offers something the device will refuse.
   */
  onOpenReconstruction?: () => void;
  onContinue: () => void;
}

const LawnStep: React.FC<Props> = ({
  slug,
  host,
  arCapable,
  cameraGranted,
  onRequestCamera,
  onSpeaking,
  onOpenReconstruction,
  prefetch,
  onContinue,
}) => {
  const { t } = useTranslation();
  const arRef = useRef<EpocheyeDetectARHandle>(null);
  const videoRef = useRef<VideoRef>(null);

  // Assets. figureUri is held back from the glbUri prop until placement time so
  // the prop update and the placeInFront() command land together (the recipe).
  const [figureUri, setFigureUri] = useState<string | null>(null);
  const [welcomeUri, setWelcomeUri] = useState<string | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetsFailed, setAssetsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // AR session.
  const [glbUri, setGlbUri] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [warmUpDone, setWarmUpDone] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [activationDone, setActivationDone] = useState(false);
  const [arError, setArError] = useState<string | null>(null);
  const placedOnceRef = useRef(false);

  const [voice, setVoice] = useState<VoiceState>('idle');
  const spokeRef = useRef(false);
  const speaking = voice === 'speaking';

  // The hand-off to the next step. Every timer body below reads the REFS, never
  // these values through a closure captured when the timer was armed — the same
  // convention PointLearnStep's watchdogs follow, and the reason a "Stay a
  // moment" pressed a millisecond before the beat expires is still honoured.
  const [handoff, setHandoff] = useState<HandoffState>('none');
  const handoffRef = useRef<HandoffState>('none');
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef<VoiceState>('idle');
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // onContinue is a NEW inline arrow on every PalaceJourneyScreen render, and
  // that screen re-renders throughout the welcome (prefetchMedia reports per
  // file). Mirroring it keeps it out of every dependency array here: a timer
  // that re-armed on each prefetch tick would never fire at all.
  const onContinueRef = useRef(onContinue);
  useEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  const showAr = arCapable && cameraGranted;

  /**
   * The step is showing the camera gate instead of itself.
   *
   * This is an EARLY RETURN further down (the CameraGate branch), so every hook
   * above it still runs while none of the JSX below it — the <Video>, the panel,
   * its "Stay a moment" escape — is mounted at all. Without this flag the step
   * happily entered 'speaking' behind that gate, armed the completion watchdogs
   * against a player that was never rendered, and 21.5 s later (START_TIMEOUT_MS
   * + the hand-off beat) 'stalled' walked the visitor past the whole arrival
   * step while they were still reading "Allow the camera" — or worse, while they
   * were away in Settings granting it. They came back to a journey that had
   * moved on without ever showing them the host. It also posted
   * journey_welcome_started for a welcome that never played, poisoning the one
   * metric added to diagnose the original freeze.
   */
  const cameraGated = arCapable && !cameraGranted;

  // 1. Resolve the figure (through the production GLB cache) and the welcome
  //    audio (through the media cache) together. `attempt` re-runs this after a
  //    failure. resolveModelGlb never throws — it degrades to the remote URL —
  //    so "failed" here means no CDN and no bundled copy at all.
  useEffect(() => {
    let cancelled = false;
    setAssetsReady(false);
    setAssetsFailed(false);
    const welcomeUrl = journeyWelcomeUrl(host);
    (async () => {
      const [figure, welcome] = await Promise.all([
        showAr ? resolveModelGlb(host.figureModelId) : Promise.resolve(null),
        welcomeUrl ? getOrFetchMedia(welcomeUrl) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (showAr && !figure) {
        setAssetsFailed(true);
        return;
      }
      setFigureUri(figure);
      setWelcomeUri(welcome);
      setAssetsReady(true);
    })().catch(err => {
      if (cancelled) return;
      if (__DEV__) console.warn('[journey] lawn assets failed', err);
      setAssetsFailed(true);
      setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [host, showAr, attempt]);

  // 2. Depth warm-up: a short wait after TRACKING before placing without a tap.
  useEffect(() => {
    if (!showAr || !tracking || warmUpDone) return;
    const timer = setTimeout(() => setWarmUpDone(true), FIGURE_WARM_UP_MS);
    return () => clearTimeout(timer);
  }, [showAr, tracking, warmUpDone]);

  // 3. Auto-place once: model resolved + tracking + warm-up. Native defers the
  //    actual placement until the glbUri prop has loaded (tryPlacePending), so
  //    the prop update and the command may race freely.
  useEffect(() => {
    if (!showAr || !figureUri || !tracking || !warmUpDone) return;
    if (placedOnceRef.current) return;
    placedOnceRef.current = true;
    setGlbUri(figureUri);
    arRef.current?.placeInFront();
    // `attempt` is a dependency on purpose: a retry re-arms placement even when
    // the resolved URI and tracking state are unchanged.
  }, [showAr, figureUri, tracking, warmUpDone, attempt]);

  // 4. Speak once he is standing there and the activation overlay has cleared
  //    (or straight away on a phone with no AR to wait for).
  const readyToSpeak = showAr ? placed && activationDone : true;
  useEffect(() => {
    // Nothing starts behind the camera gate: no player is mounted there, so a
    // "welcome" begun in that branch is silence with a watchdog on it.
    if (cameraGated) return;
    if (voice !== 'idle' || !readyToSpeak || !assetsReady) return;
    if (!welcomeUri) {
      // No narration reachable (no CDN configured). Don't strand the visitor:
      // 'failed' arms the hand-off below exactly like a welcome that played, so
      // a silent lawn still walks him on instead of dead-ending.
      setVoice('failed');
      return;
    }
    (console.log('[journey] lawn voice -> speaking'), setVoice('speaking'));
    if (!spokeRef.current) {
      spokeRef.current = true;
      onSpeaking();
      analytics.track('journey_welcome_started', { slug, ar: showAr });
    }
  }, [
    cameraGated,
    voice,
    readyToSpeak,
    assetsReady,
    welcomeUri,
    showAr,
    slug,
    onSpeaking,
  ]);

  const clearHandoffTimer = useCallback(() => {
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
  }, []);

  // 5. The welcome is over — by whichever of the four signals arrived first.
  //    `reason` is carried into analytics on purpose: it is the only way to tell
  //    a healthy 'ended' from a phone where onEnd never came ('duration' /
  //    'stalled'), which is the question the site report could not answer.
  const finishedRef = useRef(false);
  const handleWelcomeComplete = useCallback(
    (reason: AudioCompletionReason) => {
      // Only a welcome that STARTED can finish. ExoPlayer prepares its source
      // the moment the <Video> mounts, regardless of playWhenReady, so a dead
      // URL reports onError while we are still paused and waiting for the host
      // to be placed. Posting a 'finished' for that would leave the funnel with
      // more finishes than starts and hide the very failure it measures.
      if (spokeRef.current && !finishedRef.current) {
        // Latched to the STEP, not the playback: "Hear it again" must not post a
        // second finish and unbalance the pairing with journey_welcome_started.
        finishedRef.current = true;
        analytics.track('journey_welcome_finished', { slug, ar: showAr, reason });
      }
      setVoice(reason === 'error' ? 'failed' : 'done');
    },
    [slug, showAr],
  );

  // The four <Video> callbacks, wired so a missing onEnd cannot freeze the step.
  // `paused` must be the same flag the player gets, or the hook would watch for
  // progress on a player we have deliberately stopped.
  // THE MOUTH.
  //
  // The track is keyed off the REMOTE url, never `welcomeUri`: getOrFetchMedia
  // hands back a file:// path once the mp3 is cached, and a file:// path has no
  // .lipsync.json beside it. Deriving from the CDN url keeps voice and mouth
  // pointing at the same recording however the audio itself happens to arrive.
  const { track: visemeTrack } = useVisemeTrack(journeyWelcomeUrl(host));

  const {
    handlers: audioHandlers,
    reset: resetAudio,
    progress: audioProgress,
  } = useAudioCompletion({
    // `cameraGated` is belt and braces on top of the speak effect's own guard:
    // the hook must never be armed while the branch holding its player is not
    // the branch being rendered.
    paused: !speaking || cameraGated,
    onComplete: handleWelcomeComplete,
  });

  /** Leave for the next step, by the same path a manual tap has always used. */
  const advance = useCallback(
    (via: 'follow' | 'skip' | 'auto') => {
      clearHandoffTimer();
      handoffRef.current = 'gone';
      console.log('[journey] lawn handoff -> gone (advancing)');
      setHandoff('gone');
      setVoice(v => (v === 'speaking' ? 'done' : v));
      analytics.track('journey_arrival_advanced', {
        slug,
        via,
        ar: showAr,
        welcome: voiceRef.current,
      });
      onContinueRef.current();
    },
    [clearHandoffTimer, slug, showAr],
  );

  // 6. Arm the hand-off once the welcome has ended, however it ended. Guarded on
  //    the REF rather than the state so a re-render between the two can never
  //    arm a second timer, and so 'cancelled' stays cancelled.
  useEffect(() => {
    if (handoffRef.current !== 'none') return;
    if (voice !== 'done' && voice !== 'failed') return;
    // Nothing hands anyone on from behind the camera gate: the panel that says
    // he is going inside, and the "Stay a moment" that stops it, are both below
    // that early return, so the visitor would be moved with no warning and no
    // way to refuse.
    if (cameraGated) return;
    // And nothing hands anyone on before the welcome has even reached them.
    // 'failed' arrives from two places: the welcome we could not play (fine —
    // readyToSpeak is true by then and the panel shows voiceFailed with "Follow
    // him" on it), and a dead URL that ExoPlayer rejected while the visitor was
    // still moving the phone around with the activation overlay up and the host
    // not yet placed. The second one used to skip the whole arrival step ~1.5 s
    // after mount — and then do it again every time they pressed back into it,
    // making the step unreachable. So the beat needs the welcome to have started
    // (spokeRef) or the visitor to at least be standing in front of the placed
    // host, ready to be led.
    if (!spokeRef.current && !readyToSpeak) return;
    handoffRef.current = 'counting';
    console.log('[journey] lawn handoff -> counting (auto-advance armed)');
    setHandoff('counting');
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      // Re-read the ref: clearTimeout loses a race with a callback that has
      // already been queued, and this one advances the journey.
      if (handoffRef.current !== 'counting') return;
      advance('auto');
    }, WELCOME_HANDOFF_MS);
  }, [voice, cameraGated, readyToSpeak, advance]);

  // Nothing outlives the screen. A beat left running would call onContinue after
  // the visitor had already closed the journey.
  useEffect(() => clearHandoffTimer, [clearHandoffTimer]);

  const handleTrackingState = useCallback((state: string) => {
    setTracking(state === 'TRACKING');
  }, []);

  const handleAnchorPlaced = useCallback(
    (label: string) => {
      setPlaced(true);
      setArError(null);
      analytics.track('journey_figure_placed', { slug, label });
    },
    [slug],
  );

  // Native emits '' when a tracking fault CLEARS — that is not a failure.
  //
  // NOTE what this no longer receives. Tracking failures used to arrive here too, as
  // the RAW ARCore enum, and the line below puts whatever it gets straight into the
  // status pill — so a visitor in a dark room was shown the literal text
  // INSUFFICIENT_LIGHT. Those now travel on their own channel and are translated by
  // useArSessionHealth; this handler is left for genuine app faults only ("model
  // load failed", "no floor at that point"), which are already written as sentences.
  const handleArError = useCallback((err: string) => {
    setArError(err ? err : null);
  }, []);

  // The live "AR has lost its place" reporter. Its handlers are wired straight to the
  // view below; it debounces so a single-frame glitch cannot flash a banner.
  const arHealth = useArSessionHealth();

  const handleTapToPlace = useCallback(
    (x: number, y: number) => {
      if (!figureUri) return;
      // A tap is the authoritative placement: it removes the floor-height guess.
      placedOnceRef.current = true;
      setGlbUri(figureUri);
      arRef.current?.placeAtScreenPoint(x, y);
    },
    [figureUri],
  );

  const handleRetry = useCallback(() => {
    setArError(null);
    setPlaced(false);
    placedOnceRef.current = false;
    setGlbUri(null);
    arRef.current?.clearAnchor();
    setAttempt(n => n + 1);
  }, []);

  /** "Follow him" — the forward control, present in every state of the panel. */
  const handleFollow = useCallback(() => advance('follow'), [advance]);

  /** "Skip the welcome" — the same destination, for a visitor who won't listen. */
  const handleSkip = useCallback(() => advance('skip'), [advance]);

  /**
   * "Stay a moment" — cancels the hand-off and leaves him standing there. The
   * beat is not re-armed by anything after this; going on becomes a tap again.
   */
  const handleStay = useCallback(() => {
    clearHandoffTimer();
    handoffRef.current = 'cancelled';
    console.log('[journey] lawn handoff -> cancelled by visitor');
    setHandoff('cancelled');
  }, [clearHandoffTimer]);

  const handleReplay = useCallback(() => {
    // Hearing it again re-opens the hand-off — that is the visitor's own doing,
    // not a cancelled beat quietly restarting itself.
    clearHandoffTimer();
    handoffRef.current = 'none';
    setHandoff('none');
    // Re-arm the completion watchdogs BEFORE the player is un-paused, so the
    // replay is covered by the same four signals as the first play.
    resetAudio();
    videoRef.current?.seek(0);
    setVoice('speaking');
  }, [clearHandoffTimer, resetAudio]);

  // ---- Copy for the state line over the feed (words, never a spinner). ----
  let status: string | null = null;
  if (showAr && !placed) {
    if (assetsFailed) status = t('journey.arrival.loadFailed');
    else if (arError) status = arError;
    else if (!tracking) status = t('journey.arrival.findGround');
    else if (!warmUpDone || !figureUri) status = t('journey.arrival.holdSteady');
    else status = t('journey.arrival.tapToPlace');
  }

  /**
   * WHERE YOU ARE AND WHAT TO DO, before anything is revealed.
   *
   * REUSED, NOT REWRITTEN. The tour's first stop already says it - "Stand out
   * on the lawn in front of the palace, far enough back to see the whole front
   * at once. Face the building." - and it was written for exactly this moment,
   * by someone thinking about a visitor holding a phone in a garden. Writing a
   * second sentence beside it would give the same instruction two voices.
   *
   * `tourFor` returns [] for any venue without a magic window, and the honest
   * answer there is nothing rather than an invented direction; the panel simply
   * omits the line. That is the same refusal `walkToForStop` documents.
   *
   * Index 0 is the arrival by construction: PALACE_TOUR is ordered as a walk and
   * opens on P0, the front lawn.
   */
  const arrivalLine = useMemo(() => tourFor(slug)[0]?.walkTo, [slug]);

  const welcomeShown = showAr ? placed : true;
  const savingLine =
    prefetch && prefetch.total > 0
      ? t('journey.prepare.caching.progress', {
          done: prefetch.cached + prefetch.failed,
          total: prefetch.total,
        })
      : null;

  // ---- Copy and controls for the panel. ----
  // The beat is running: say so, in words, so the screen changing under the
  // visitor is something he was told about a moment before it happened.
  const leading = handoff === 'counting' || handoff === 'gone';
  // "Hear it again" needs a welcome that actually played; after an error there
  // is nothing to replay.
  const canReplay = voice === 'done' && !!welcomeUri;
  let bodyLine: string | null;
  if (speaking) bodyLine = t('journey.arrival.speaking');
  else if (voice === 'failed') bodyLine = t('journey.arrival.voiceFailed');
  else if (handoff === 'cancelled') bodyLine = t('journey.arrival.stayed');
  else if (voice === 'done') bodyLine = null; // the leading line says it all
  else bodyLine = t('journey.arrival.appeared');

  // Camera declined on an AR phone: ask again, or skip straight on.
  if (arCapable && !cameraGranted) {
    return (
      <CameraGate
        onAllow={onRequestCamera}
        onSkip={handleSkip}
        skipLabel={t('journey.arrival.skipWelcome')}
      />
    );
  }

  return (
    <View style={journeyStyles.root}>
      {showAr ? (
        <EpocheyeDetectARView
          ref={arRef}
          style={StyleSheet.absoluteFill}
          glbUri={glbUri ?? undefined}
          // Normalised sizing on purpose: the rig's skeleton/mesh unit mismatch is
          // hidden only by scaleToUnits (see journeyConfig). Never modelTrueScale.
          modelScale={host.figureScaleM}
          groundAnchored
          // TALK ONLY WHILE HE IS ACTUALLY TALKING.
          //
          // This was `voice === 'done' ? idle : talk`, which put the talk clip on
          // three of the four states — including 'failed'. Native loops whatever
          // clip it is given, so when the welcome audio errored (a weak signal on
          // the lawn is enough: getOrFetchMedia hands ExoPlayer the remote URL when
          // the download fails) the host stood there gesturing and mouthing in total
          // silence, forever, directly under copy reading "The welcome couldn't
          // play." Nothing exits 'failed', so it never recovered.
          animationClip={voice === 'speaking' ? host.talkClip : host.idleClip}
          // The mouth rides on the SAME `speaking` flag as the talk clip and the
          // player's own `paused`, so it can never be moving while he is silent.
          // Position comes from useAudioCompletion's progress rather than a timer
          // started here: that is the player's real playhead, which is the only
          // clock that survives a stall, a pause, or an audio-focus loss.
          visemeTrack={visemeTrack ?? undefined}
          visemePlaying={voice === 'speaking'}
          visemePositionMs={Math.round(audioProgress.position * 1000)}
          faceViewer
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
        />
      ) : (
        <View style={styles.audioOnlyBackdrop} />
      )}

      {/* Tap the ground to place him. Rendered BEFORE the controls so they win. */}
      {showAr ? (
        <Pressable
          style={journeyStyles.tapLayer}
          accessibilityLabel={t('journey.arrival.tapToPlace')}
          onPress={e => {
            const { locationX, locationY } = e.nativeEvent;
            handleTapToPlace(locationX, locationY);
          }}
        />
      ) : null}

      {status ? <StatusPill text={status} /> : null}

      {/* Live AR health, over the feed. Renders nothing while the session is well,
          so the common case costs nothing. "Try again" re-arms placement rather than
          restarting the step — the welcome keeps playing underneath. */}
      <ArSessionBanner
        health={arHealth}
        onRetry={() => {
          arHealth.reset();
          setArError(null);
          arRef.current?.placeInFront();
        }}
      />

      {/* The welcome itself. Audio-only, so no size and no controls — this is a
          man talking, not a media player.

          onEnd/onError come from useAudioCompletion together with onLoad and
          onProgress: the step used to hang its whole flow on onEnd alone, and on
          Android that event never arrives if audio focus is denied at un-pause
          or lost mid-clip (an earphone or Bluetooth switch is enough — which is
          what the visitor who reported the freeze was doing). Spread, never
          hand-picked: dropping one of the four quietly removes a backstop. */}
      {welcomeUri ? (
        <Video
          ref={videoRef}
          source={{ uri: welcomeUri }}
          paused={!speaking}
          repeat={false}
          ignoreSilentSwitch="ignore"
          {...audioHandlers}
          style={journeyStyles.hiddenAudio}
        />
      ) : null}

      {showAr ? (
        <ARActivationOverlay
          visible={!activationDone}
          onDone={() => setActivationDone(true)}
          title={t('journey.steps.arrival')}
        />
      ) : null}

      <View style={journeyStyles.panel}>
        <Text style={journeyStyles.eyebrow}>{t('journey.arrival.eyebrow')}</Text>
        {welcomeShown ? (
          <>
            <Text style={journeyStyles.title}>{t('journey.arrival.welcomeTitle')}</Text>
            {!showAr ? (
              <Text style={journeyStyles.body}>{t('journey.arrival.audioOnly')}</Text>
            ) : null}
            {bodyLine ? <Text style={journeyStyles.body}>{bodyLine}</Text> : null}
            {leading ? (
              <Text style={journeyStyles.bodyStrong}>
                {t('journey.arrival.leading')}
              </Text>
            ) : null}
            {savingLine ? <Text style={journeyStyles.caption}>{savingLine}</Text> : null}
            <View style={journeyStyles.buttonRow}>
              {/* The forward control is on the panel in EVERY state, including
                  while he is still speaking. Before, "Skip the welcome" was the
                  only control during the welcome — and after listening to the
                  whole thing nobody presses "skip", which is how a step that had
                  simply finished read as a frozen one. */}
              <PrimaryButton
                label={t('journey.arrival.follow')}
                icon={<Footprints size={18} color={JOURNEY_INK} />}
                onPress={handleFollow}
              />
              {/* Same destination, the wording a visitor who doesn't want to
                  listen is looking for. Kept only while he is actually talking —
                  once the welcome is over there is nothing left to skip. */}
              {speaking ? (
                <GhostButton
                  label={t('journey.arrival.skipWelcome')}
                  onPress={handleSkip}
                />
              ) : null}
              {handoff === 'counting' ? (
                <GhostButton label={t('journey.arrival.stay')} onPress={handleStay} />
              ) : null}
              {canReplay ? (
                <GhostButton
                  label={t('journey.arrival.replay')}
                  icon={<RotateCcw size={16} color={JOURNEY_GOLD} />}
                  onPress={handleReplay}
                />
              ) : null}
              {/* Only where stations are authored AND the phone can hold them
                  in place. The parent decides both; omitted, nothing renders. */}
              {onOpenReconstruction ? (
                <GhostButton
                  label={t('journey.arrival.seeReconstruction')}
                  onPress={onOpenReconstruction}
                />
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Text style={journeyStyles.title}>{t('journey.arrival.title')}</Text>
            {/* The orientation line first, then the tracking status. A visitor
                who has just opened this is looking at a garden and a camera
                feed; "hold steady while we find the ground" answers a question
                they have not asked yet. Where they should stand does. */}
            {arrivalLine ? (
              <Text style={journeyStyles.body}>{arrivalLine}</Text>
            ) : null}
            <Text style={journeyStyles.caption}>
              {t('journey.arrival.findGround')}
            </Text>
            {/* The way out is ALWAYS here, not only after an error was reported.
                If the figure never places and ARCore never emits a fault — a
                tracking session that simply never settles — this branch used to
                render no control at all, and the only escape from the journey
                was the close button in the top bar. */}
            <View style={journeyStyles.buttonRow}>
              {assetsFailed || arError ? (
                <PrimaryButton label={t('common.tryAgain')} onPress={handleRetry} />
              ) : null}
              <GhostButton
                label={t('journey.arrival.skipWelcome')}
                onPress={handleSkip}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  audioOnlyBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.bgWarm },
});

export default LawnStep;
