/**
 * useAudioCompletion — one honest answer to "has this audio finished?".
 *
 * The journey froze on the lawn because it trusted a single media callback.
 * LawnStep drove the whole step from `<Video onEnd>`: that DirectEvent was the
 * only autonomous way out of `voice === 'speaking'`, so when it never arrived
 * the visitor was left with a panel offering nothing but "Skip the welcome",
 * after the welcome had already been heard.
 *
 * `onEnd` is not a callback you can lean on alone on Android. It is emitted from
 * ExoPlayer's `Player.STATE_ENDED`, and there are shipped paths in
 * react-native-video 6.19.1 that stop the audio without ever reaching that state
 * and without telling JS anything:
 *
 *  (A) Audio focus DENIED at un-pause. ReactExoplayerView.setPlayWhenReady(true)
 *      requests focus and, if it is not granted, simply never calls
 *      player.setPlayWhenReady(true) — no retry, no event. The `paused` prop is
 *      already false so React re-sends nothing. The player sits at STATE_READY
 *      forever. (An earphone/Bluetooth route change at the moment the welcome
 *      starts is enough — which is exactly what the owner was doing.)
 *  (B) AUDIOFOCUS_LOSS mid-playback pauses natively and reports only via
 *      `onAudioFocusChanged`. Same terminal state: silence, `paused` still false,
 *      no onEnd, ever.
 *  (C) A dead URL: onError fires and onEnd never will.
 *
 * The mirror of that problem is a watchdog that fires when nothing is wrong, and
 * there is one shipped path for that too: (D) the app going to the background,
 * where Android stops the player and freezes our timers behind JS's back. See
 * isForeground below — the hook watches AppState so that a glance at a
 * notification is not read as a dead player.
 *
 * So this hook treats "finished" as whichever of four signals lands FIRST, and
 * fires completion exactly once per playback:
 *
 *   'ended'    the real onEnd — the happy path, unchanged
 *   'duration' the clip has had its whole length (plus a grace margin) to play
 *   'stalled'  currentTime stopped moving while we believe it is playing
 *   'error'    onError — a visitor is never stranded by a broken file
 *
 * It owns nothing but timers and refs: give it the four <Video> callbacks and
 * the same `paused` flag you give the player, and read `state`/`reason` back.
 * It deliberately imports only TYPES from react-native-video, so it is testable
 * without the native module.
 *
 * UNITS: react-native-video reports `duration` and `currentTime` in SECONDS on
 * both platforms (VideoEventEmitter divides the ExoPlayer milliseconds by 1000).
 * Everything named *_MS here is milliseconds; everything on `progress` is
 * seconds. Mixing the two silently is how a backstop ends up 1000x wrong.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type {
  OnLoadData,
  OnProgressData,
  OnVideoErrorData,
} from 'react-native-video';

/**
 * How much longer than the clip's own length to wait before calling it finished.
 *
 * The duration backstop is armed against the clock, not against the decoder, so
 * it has to absorb the normal slop of real playback: a re-buffer, a slow start
 * after seek, the gap between the last onProgress tick (250 ms by default) and
 * STATE_ENDED. Too small and we cut off the last words of the welcome; too large
 * and a silently-dead player holds the journey for that much longer. A second
 * and a bit is comfortably past the tick interval and unnoticeable to a visitor
 * who has just heard the audio end.
 */
export const DURATION_GRACE_MS = 1200;

/**
 * How long currentTime may sit still, while we believe playback is running,
 * before we conclude it has stopped for good.
 *
 * Native suppresses duplicate progress events (updateProgress only emits when
 * the position, buffer or duration actually changed), so a stalled player emits
 * NOTHING — silence on this channel is the signal. This guards failure (B): the
 * audio was playing, focus was lost to a call or another app, and native paused
 * behind JS's back. Eight seconds is long enough that an ordinary re-buffer on a
 * weak signal recovers first, short enough that the visitor is not left staring
 * at a frozen panel.
 */
export const STALL_TIMEOUT_MS = 8000;

/**
 * The same watchdog, but for a playback that never produced a single progress
 * tick — i.e. it never started at all.
 *
 * This is the one that catches failure (A), where nothing plays and no event of
 * any kind arrives. It is deliberately much more generous than STALL_TIMEOUT_MS
 * because the first tick is the one most likely to be late for an innocent
 * reason: getOrFetchMedia hands ExoPlayer the REMOTE url whenever the download
 * failed, so on a bad connection the welcome genuinely can take many seconds to
 * begin ("it arrived after a delay", as the owner put it). Firing early here
 * would cut off a welcome that was merely buffering, which is a worse bug than
 * the one we are fixing.
 */
export const START_TIMEOUT_MS = 20000;

/**
 * Position must move by more than this (seconds) for a progress tick to count as
 * proof of life. Guards against float noise in a value that arrives as ms/1000.
 */
const POSITION_EPSILON_S = 0.001;

/**
 * Is the app actually in front of the visitor?
 *
 * A backgrounded app is not a dead player, and it must not be watched like one.
 * Two things happen together the moment Android pauses the activity, and each
 * one on its own is enough to fire a false 'stalled':
 *
 *  - react-native-video calls setPlayWhenReady(false) on host pause unless
 *    `playInBackground` is set (LawnStep's welcome deliberately does not set it
 *    — a welcome playing into somebody's ear while they read a notification is
 *    not what "he speaks to you on the lawn" means). Progress ticks stop, but
 *    the `paused` PROP never changes, so without this the hook still believes it
 *    is watching a playing clip.
 *  - React Native freezes JS timers while the host is paused (JavaTimerManager
 *    clears the frame callback on onHostPause) and then fires EVERY expired one
 *    on the first frame after resume. A deadline that lapsed while the phone was
 *    in a pocket therefore lands ~16 ms after the visitor comes back, before the
 *    250 ms progress tick that would have re-armed it.
 *
 * Reported as: glance at a WhatsApp notification for ten seconds during Tipu's
 * welcome, come back, and the welcome is cut off mid-sentence and the journey
 * walks itself to the next step. So a non-foreground app disarms the watchdogs
 * exactly like a deliberate pause, and returning re-arms them from scratch.
 *
 * Only states we KNOW are away count. `AppState.currentState` is null before the
 * native module has reported once, and anything unrecognised must be read as
 * "in front of the visitor" — the failure of guessing the other way is a hook
 * that never arms at all, i.e. the original freeze.
 */
function isForeground(status: AppStateStatus | null | undefined): boolean {
  return status !== 'background' && status !== 'inactive';
}

/** 'failed' is reserved for onError; every other ending is 'done'. */
export type AudioCompletionState = 'idle' | 'playing' | 'done' | 'failed';

/** Which of the four signals ended this playback. null until one of them does. */
export type AudioCompletionReason = 'ended' | 'duration' | 'stalled' | 'error';

export interface AudioProgress {
  /** Seconds played. */
  position: number;
  /** Seconds total, or 0 while unknown (also 0 for a live/unbounded source). */
  duration: number;
}

/** Exactly the four <Video> props this hook needs; spread them onto the player. */
export interface AudioCompletionHandlers {
  onLoad: (data: OnLoadData) => void;
  onProgress: (data: OnProgressData) => void;
  onEnd: () => void;
  onError: (data?: OnVideoErrorData) => void;
}

export interface UseAudioCompletionOptions {
  /**
   * The SAME flag you pass to <Video paused={...}>. Nothing is armed while this
   * is true: a paused player is supposed to make no progress, so watching one
   * would fire the stall watchdog on every deliberate pause.
   *
   * Pass true as well whenever the player is not on screen at all. The hook
   * cannot see the tree it is watching, so a caller that mounts its <Video>
   * below an early return (LawnStep's camera gate) must say so here, or the
   * watchdogs count down against a player that does not exist and 'complete'
   * a playback that never happened.
   */
  paused: boolean;
  /**
   * Fired ONCE per playback, the moment any of the four signals lands. Its
   * identity is mirrored in a ref, so passing a fresh arrow on every render
   * (which callers do — see PalaceJourneyScreen's inline onContinue) cannot
   * restart the timers.
   */
  onComplete?: (reason: AudioCompletionReason) => void;
  /** Override DURATION_GRACE_MS. */
  durationGraceMs?: number;
  /** Override STALL_TIMEOUT_MS. */
  stallTimeoutMs?: number;
  /** Override START_TIMEOUT_MS. */
  startTimeoutMs?: number;
}

export interface UseAudioCompletionResult {
  state: AudioCompletionState;
  reason: AudioCompletionReason | null;
  progress: AudioProgress;
  handlers: AudioCompletionHandlers;
  /** Re-arm for another playback (replay). Clears state, reason and position. */
  reset: () => void;
}

export function useAudioCompletion({
  paused,
  onComplete,
  durationGraceMs = DURATION_GRACE_MS,
  stallTimeoutMs = STALL_TIMEOUT_MS,
  startTimeoutMs = START_TIMEOUT_MS,
}: UseAudioCompletionOptions): UseAudioCompletionResult {
  const [state, setState] = useState<AudioCompletionState>('idle');
  const [reason, setReason] = useState<AudioCompletionReason | null>(null);
  const [progress, setProgress] = useState<AudioProgress>({
    position: 0,
    duration: 0,
  });

  // ---- Refs, because every timer body must read live values, never a closure
  //      captured when the timer was armed (the house watchdog convention). ----
  const completedRef = useRef(false);
  const startedRef = useRef(false);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Foreground tracking. Subscribed once, for the lifetime of the hook: the
  // subscription is what makes a pocketed phone indistinguishable from a
  // deliberate pause, and both from a player that has actually died.
  const [foreground, setForeground] = useState(() =>
    isForeground(AppState.currentState),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', next =>
      setForeground(isForeground(next)),
    );
    return () => sub.remove();
  }, []);

  /**
   * Nothing is expected to be playing: the caller paused it, or the app is not
   * in front of the visitor. Every watchdog reads THIS, never `paused` alone.
   */
  const halted = paused || !foreground;
  const haltedRef = useRef(halted);
  useEffect(() => {
    haltedRef.current = halted;
  }, [halted]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimers = useCallback(() => {
    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const complete = useCallback(
    (why: AudioCompletionReason) => {
      // The whole point of the hook: four signals, one completion. Whichever
      // arrives first wins and the rest are ignored, so a duration backstop that
      // fires a moment before a late onEnd cannot advance the journey twice.
      if (completedRef.current) return;
      completedRef.current = true;
      clearTimers();
      // FIELD LOG. Three separate diagnoses of the lawn stall were guesses because
      // nothing in the journey wrote a line to logcat; the phone could confirm or
      // refute none of them. Plain console.log, same convention as geofenceService,
      // so it survives into any build and can be read with `adb logcat`.
      console.log(
        `[journey] audio complete reason=${why} pos=${positionRef.current.toFixed(1)}s ` +
          `dur=${durationRef.current.toFixed(1)}s started=${startedRef.current}`,
      );
      setReason(why);
      setState(why === 'error' ? 'failed' : 'done');
      onCompleteRef.current?.(why);
    },
    [clearTimers],
  );

  const armTimers = useCallback(() => {
    clearTimers();
    if (completedRef.current) return;

    // Duration backstop. Re-armed from the CURRENT position on every tick, so a
    // pause, a seek or a re-buffer moves the deadline with the audio instead of
    // counting down from wherever playback happened to start.
    const duration = durationRef.current;
    if (duration > 0) {
      const remainingMs =
        Math.max(0, (duration - positionRef.current) * 1000) + durationGraceMs;
      durationTimerRef.current = setTimeout(() => {
        durationTimerRef.current = null;
        complete('duration');
      }, remainingMs);
    }

    // Stall watchdog. Before the first tick we are waiting for playback to
    // START (generous); after it we are watching a player that has proved it
    // works and then went quiet (tight).
    const quietMs = startedRef.current ? stallTimeoutMs : startTimeoutMs;
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      complete('stalled');
    }, quietMs);
  }, [clearTimers, complete, durationGraceMs, stallTimeoutMs, startTimeoutMs]);

  // Playback starts and stops here, and nowhere else. reset() arms directly only
  // in the one case this effect cannot see: a re-arm while `halted` is already
  // false, where no dependency changes and the effect therefore never re-runs.
  useEffect(() => {
    if (completedRef.current) return;
    if (halted) {
      // Includes the app going away: the deadline that was counting down is
      // discarded rather than left to expire in a pocket and fire on return.
      clearTimers();
      return;
    }
    setState('playing');
    // Whatever we are resuming has to spin back up — re-acquire audio focus,
    // re-buffer, and on Android re-issue setPlayWhenReady — before it can prove
    // it is alive, so it gets the generous START budget rather than the tight
    // stall one. A single progress tick tightens it again.
    startedRef.current = false;
    armTimers();
    return clearTimers;
  }, [halted, armTimers, clearTimers]);

  // Unmount: nothing may outlive the screen. Leaving a watchdog running would
  // call onComplete — i.e. advance the journey — after the visitor has left.
  useEffect(() => clearTimers, [clearTimers]);

  const handleLoad = useCallback(
    (data: OnLoadData) => {
      const seconds = Number(data?.duration);
      // A live or unbounded source reports 0 / Infinity. Refuse it rather than
      // arming a backstop that would fire immediately; the stall watchdog still
      // covers that case.
      if (Number.isFinite(seconds) && seconds > 0) {
        durationRef.current = seconds;
        setProgress(p => ({ ...p, duration: seconds }));
      }
      // The duration backstop exists ONLY if this number arrives and is finite.
      // If a Bluetooth route reports 0 or Infinity we fall back to the stall
      // watchdog, and the log is the only way to tell those two cases apart.
      console.log(
        `[journey] audio onLoad duration=${String(data?.duration)} usable=${
          Number.isFinite(seconds) && seconds > 0
        }`,
      );
      if (!completedRef.current && !haltedRef.current) armTimers();
    },
    [armTimers],
  );

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      const seconds = Number(data?.currentTime);
      if (!Number.isFinite(seconds)) return;

      // `seekableDuration` is player.getDuration() — so a source whose onLoad
      // was missed still gets a duration backstop from the first tick.
      const seekable = Number(data?.seekableDuration);
      if (
        durationRef.current <= 0 &&
        Number.isFinite(seekable) &&
        seekable > 0
      ) {
        durationRef.current = seekable;
      }

      // Any MOVEMENT is proof of life, forwards or back: a seek is as good as a
      // tick, and it changes how much is left to play, so the deadlines must be
      // recomputed from the new position either way.
      const moved = Math.abs(seconds - positionRef.current) > POSITION_EPSILON_S;
      positionRef.current = seconds;
      setProgress({ position: seconds, duration: durationRef.current });

      if (completedRef.current) return;
      startedRef.current = true;
      if (moved && !haltedRef.current) armTimers();
    },
    [armTimers],
  );

  const handleEnd = useCallback(() => complete('ended'), [complete]);

  const handleError = useCallback(
    (data?: OnVideoErrorData) => {
      if (__DEV__) console.warn('[journey] audio failed', data);
      complete('error');
    },
    [complete],
  );

  const reset = useCallback(() => {
    clearTimers();
    completedRef.current = false;
    startedRef.current = false;
    positionRef.current = 0;
    // Duration survives: it is a property of the clip, not of this playback, and
    // a replay after seek(0) may never re-emit onLoad.
    setProgress(p => ({ position: 0, duration: p.duration }));
    setReason(null);
    if (haltedRef.current) {
      // The usual replay: the caller un-pauses in the same tap, so the arming
      // effect will run on the next render and start the watchdogs there. Same
      // path when the app is away — coming back re-runs it.
      setState('idle');
      return;
    }
    setState('playing');
    armTimers();
  }, [armTimers, clearTimers]);

  const handlers = useMemo<AudioCompletionHandlers>(
    () => ({
      onLoad: handleLoad,
      onProgress: handleProgress,
      onEnd: handleEnd,
      onError: handleError,
    }),
    [handleLoad, handleProgress, handleEnd, handleError],
  );

  return { state, reason, progress, handlers, reset };
}

export default useAudioCompletion;
