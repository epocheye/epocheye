/**
 * AudioPlayer
 *
 * Full-featured audio player component with:
 * - Seekable scrub bar (via PanResponder)
 * - Playback speed control (0.5x–2x)
 * - Background audio support
 * - Heritage-dark styling
 *
 * Uses react-native-video v6 under the hood.
 *
 * TWO CALLERS, TWO SHAPES, ONE PLAYER. The audio-guide screen keeps ONE instance
 * mounted and swaps `uri`/`sourceKey` between stops (which is what preserves the
 * chosen speed and avoids a gap); the journey's guide step REMOUNTS a fresh one
 * per stop (which is what throws away the completion watchdog's cached duration
 * along with the player it belonged to). Both are supported deliberately — the
 * reset effect covers the first, and everything is safe to run on mount for the
 * second.
 *
 * Everything below `title` is OPTIONAL and additive. Omit it all and this
 * component behaves exactly as it always has: it mounts paused, waits for a tap
 * on Play, and tells nobody anything.
 *
 * Those props exist for a caller that has to drive a CHAIN of clips — the
 * journey's audio guide plays one stop and walks on to the next by itself — and
 * such a caller needs two things this component used to keep to itself:
 *
 *  - the raw <Video> callbacks, so a completion watchdog outside can judge for
 *    itself whether the audio is actually moving. `onEnd` alone is not enough on
 *    Android: audio focus can be denied at un-pause or lost mid-clip, and either
 *    one stops the sound with no event of any kind, so a chain that advances
 *    only on `onEnd` freezes the first time it happens;
 *  - the play/pause state, so that a visitor's deliberate pause is never
 *    mistaken by that watchdog for a player that has died.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Video from 'react-native-video';
import type {
  OnLoadData,
  OnProgressData,
  OnVideoErrorData,
  VideoRef,
} from 'react-native-video';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Pause, Play, SkipForward } from 'lucide-react-native';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  uri: string;
  /** Optional title shown above the player */
  title?: string;
  /**
   * Start playing as soon as the source changes (and on mount). Off by default so
   * the standalone contract is unchanged; the audio guide turns it on because the
   * player instance is REUSED across stops — tapping a new stop should play it,
   * not silently swap the source behind a paused button.
   */
  autoPlay?: boolean;
  /**
   * Identity of the current source, when the caller has one more specific than
   * the URL — e.g. a stop key. Two different stops may legitimately point at the
   * SAME audio file, and keying the reset on `uri` alone means switching between
   * them leaves the previous position and paused state in place (observed on
   * device). Defaults to `uri`.
   */
  sourceKey?: string;
  /**
   * Called with the flag handed to `<Video paused={...}>` — on mount, and on
   * every change after: the autoplay, each Play/Pause tap, and the automatic
   * pause when a clip reaches its end.
   *
   * A completion watchdog outside this component cannot work without it. It has
   * to tell "no progress because the visitor paused to look at a carving" from
   * "no progress because the player silently stopped", and those look identical
   * from the progress callback alone.
   */
  onPausedChange?: (paused: boolean) => void;
  /**
   * Hold playback without touching the visitor's own play/pause choice.
   *
   * Separate from the internal `paused` state on purpose. The magic window
   * plays a viewpoint's narration continuously, and when the visitor taps a
   * figure that figure speaks over it; the clip has to duck and then carry on
   * from where it was. Unmounting would lose the position - `the_lost_colour`
   * runs 105 s - and there is no imperative handle on this component to stop
   * it with. Raising this leaves `paused` alone, so when it drops the clip
   * resumes exactly as the visitor left it, with the button still showing what
   * they chose.
   *
   * Reported through `onPausedChange` as well, because a watchdog watching for
   * a stall must not read a deliberate duck as a dead player.
   */
  suspended?: boolean;
  /** Passthrough of the player's own <Video> callback, called after this
   *  component's bookkeeping (so `duration` here is already up to date). */
  onLoad?: (data: OnLoadData) => void;
  /** Passthrough. Forwarded on EVERY tick, including while the visitor is
   *  scrubbing — see handleProgress. */
  onProgress?: (data: OnProgressData) => void;
  /** Passthrough, called after this component resets itself to the start. */
  onEnd?: () => void;
  /** Passthrough. Nothing here reacts to a playback error; a caller that cares
   *  (the guide advances rather than stranding the visitor) must handle it. */
  onError?: (data: OnVideoErrorData) => void;
  /**
   * Put a transport on the lock screen and in the notification shade.
   *
   * OFF by default, and the default is the point. Background audio does not
   * need this - a 105 s clip was measured playing to completion with the
   * screen locked and no service at all, because `playInBackground` keeps
   * ExoPlayer alive on its own. What this adds is the CONTROL, for a visitor
   * walking a building with the phone in a pocket who wants to pause without
   * unlocking it.
   *
   * That is worth a foreground service for a 105 s narration and absurd for a
   * two-second line, so it is the caller who decides. Only the two long-form
   * narration surfaces turn it on: the audio guide and the magic window. It
   * requires FOREGROUND_SERVICE_MEDIA_PLAYBACK and a declaration of
   * com.brentvatne.exoplayer.VideoPlaybackService in AndroidManifest.xml,
   * both of which the app supplies because the library ships neither.
   */
  showNotificationControls?: boolean;
  /**
   * Second line on the lock screen, under `title` - the place the clip belongs
   * to. Unused on screen; a notification with a stop name and nothing else does
   * not say which app or which building it came from.
   */
  notificationSubtitle?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  uri,
  title,
  autoPlay = false,
  sourceKey,
  onPausedChange,
  suspended = false,
  onLoad,
  onProgress,
  onEnd,
  onError,
  showNotificationControls = false,
  notificationSubtitle,
}) => {
  const trackKey = sourceKey ?? uri;
  const { t } = useTranslation();
  const videoRef = useRef<VideoRef>(null);
  /** The clip ran to its end and the player is parked there — see handleEnd. */
  const endedRef = useRef(false);
  // Initialised from autoPlay rather than always-true so a REMOUNTING caller
  // never reports a spurious paused=true to its watchdog before the reset effect
  // below has run. A caller that instead swaps the source on this same instance
  // is corrected by that effect.
  const [paused, setPaused] = useState(!autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);

  const progress = useSharedValue(0);

  // The caller's callbacks live in a ref rather than in the dependency lists
  // below. Passing an inline arrow is the normal way to hand one over, and a
  // parent that re-renders often (the journey re-renders while its media
  // pre-cache reports progress, file by file) would otherwise churn the identity
  // of every <Video> prop on this player for no reason at all.
  const callbacks = useRef({
    onLoad,
    onProgress,
    onEnd,
    onError,
    onPausedChange,
  });
  useEffect(() => {
    callbacks.current = { onLoad, onProgress, onEnd, onError, onPausedChange };
  }, [onLoad, onProgress, onEnd, onError, onPausedChange]);

  // Report the play/pause state upward, including the initial one: with
  // autoPlay the very first thing the caller needs to know is that sound has
  // started without anybody tapping anything.
  useEffect(() => {
    callbacks.current.onPausedChange?.(paused || suspended);
  }, [paused, suspended]);

  // Reset transient state whenever the source changes. This component is
  // designed to be kept mounted across sources (one player instance), so
  // without this the previous clip's scrub position would stay on screen until
  // onLoad fires, and a newly selected clip would inherit the old paused state.
  // `rate` is deliberately NOT reset — a chosen playback speed is a preference
  // that should carry across clips.
  //
  // `duration` is handled separately, and the distinction matters: when the URL
  // is genuinely new, clearing it avoids briefly showing the previous clip's
  // length, and onLoad refills it. But when only `sourceKey` changed (two stops
  // pointing at the SAME file) the media never reloads, so onLoad never fires
  // again — clearing duration there would strand the player at "-0:00" with a
  // dead scrub bar. Observed on device. In that case keep the duration and just
  // rewind the native player, which a same-URL swap won't do on its own — and
  // that seek is also what lifts STATE_ENDED, so `endedRef` clears with it.
  const prevUriRef = useRef(uri);
  useEffect(() => {
    setCurrentTime(0);
    setIsSeeking(false);
    progress.value = 0;
    setPaused(!autoPlay);
    endedRef.current = false;
    if (prevUriRef.current !== uri) {
      prevUriRef.current = uri;
      setDuration(0);
    } else {
      videoRef.current?.seek(0);
    }
    // Keyed on trackKey, not uri — see the sourceKey prop.
  }, [trackKey, uri, autoPlay, progress]);

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      if (!isSeeking) {
        setCurrentTime(data.currentTime);
        if (duration > 0) {
          progress.value = withTiming(data.currentTime / duration, {
            duration: 250,
          });
        }
      }
      // Forwarded even mid-scrub. `isSeeking` is about THIS component's scrub
      // bar, which must not jump under the visitor's thumb; a watchdog upstream
      // still needs every tick, because ticks are its only proof of life.
      callbacks.current.onProgress?.(data);
    },
    [duration, isSeeking, progress],
  );

  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    // A fresh source is a fresh player, whatever the previous one ended as.
    endedRef.current = false;
    callbacks.current.onLoad?.(data);
  }, []);

  const handleEnd = useCallback(() => {
    // The player is NOT back at the start just because this component's scrub
    // bar is: ExoPlayer parks at STATE_ENDED, and setPlayWhenReady(true) does
    // nothing from there — only a seek leaves that state. Remembered here and
    // paid for on the next Play (see handlePlayPause) rather than seeking now:
    // `paused` reaches native one commit later than an imperative seek, so
    // seeking here would restart the clip for a moment before the pause landed.
    endedRef.current = true;
    setPaused(true);
    setCurrentTime(0);
    progress.value = withTiming(0, { duration: 200 });
    callbacks.current.onEnd?.();
  }, [progress]);

  const handleSeek = useCallback(
    (fraction: number) => {
      const seekTime = Math.max(0, Math.min(1, fraction)) * duration;
      // This seek is itself what pulls the player out of STATE_ENDED, so the
      // next Play must NOT jump back to zero and throw away the position the
      // visitor just scrubbed to.
      endedRef.current = false;
      videoRef.current?.seek(seekTime);
      setCurrentTime(seekTime);
      progress.value = withTiming(fraction, { duration: 100 });
    },
    [duration, progress],
  );

  /**
   * Play/Pause. Replaying a finished clip has to seek first.
   *
   * Reachable the moment a caller autoplays a chain: the journey's audio guide
   * finishes a stop, offers "Stay on this stop", and a visitor who taps Stay and
   * then Play was left with a Pause icon, a scrub bar frozen at 0:00 and no
   * sound at all — no error, and (once the completion watchdog has latched) no
   * hand-over to rescue them either.
   */
  const handlePlayPause = useCallback(() => {
    if (paused && endedRef.current) {
      endedRef.current = false;
      videoRef.current?.seek(0);
      setCurrentTime(0);
      progress.value = 0;
    }
    setPaused(p => !p);
  }, [paused, progress]);

  const handleError = useCallback((data: OnVideoErrorData) => {
    callbacks.current.onError?.(data);
  }, []);

  const cycleSpeed = useCallback(() => {
    setRate(prev => {
      const idx = SPEED_OPTIONS.indexOf(prev as (typeof SPEED_OPTIONS)[number]);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  const remaining = duration > 0 ? duration - currentTime : 0;

  // Scrub bar pan responder.
  //
  // Two things here are load-bearing, both verified broken on device before this
  // shape:
  //
  //  1. The responder is created ONCE (useRef), so it permanently captures the
  //     closures from the first render — when `duration` was still 0. Calling
  //     `handleSeek` directly made every drag compute `fraction * 0` and jump to
  //     0:00 (the +15s button was unaffected because it calls the *current*
  //     closure from JSX). Routing through a ref that each render refreshes is
  //     what keeps the responder pointed at a live `duration`.
  //  2. Bar width comes from onLayout, not `measure()`. `measure` is async, and
  //     reading `evt.nativeEvent` inside its callback reads a recycled event.
  //     onLayout gives the width synchronously and cannot go stale.
  const barRef = useRef<View>(null);
  const barWidthRef = useRef(0);
  const handleSeekRef = useRef(handleSeek);
  handleSeekRef.current = handleSeek;

  const seekFromTouch = useCallback((locationX: number) => {
    const width = barWidthRef.current;
    if (width <= 0) return;
    handleSeekRef.current(locationX / width);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        setIsSeeking(true);
        seekFromTouch(evt.nativeEvent.locationX);
      },
      onPanResponderMove: evt => {
        seekFromTouch(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setIsSeeking(false);
      },
    }),
  ).current;

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  return (
    <View className="bg-[#141414] border border-[rgba(203,168,98,0.2)] rounded-2xl p-4">
      {/* Hidden video — audio only */}
      <Video
        ref={videoRef}
        // METADATA IS WHAT MAKES THE NOTIFICATION READABLE. media3 draws the
        // lock-screen card from the MediaItem, not from anything on this
        // component, so a player with notification controls and no metadata
        // shows a blank card with two buttons on it.
        source={{
          uri,
          metadata: showNotificationControls
            ? {title, subtitle: notificationSubtitle, artist: notificationSubtitle}
            : undefined,
        }}
        paused={paused || suspended}
        rate={rate}
        onProgress={handleProgress}
        onLoad={handleLoad}
        onEnd={handleEnd}
        onError={handleError}
        playInBackground
        playWhenInactive
        showNotificationControls={showNotificationControls}
        ignoreSilentSwitch="ignore"
        style={{ height: 0, width: 0 }}
      />

      {/* Title */}
      {title && (
        <Text className="text-[#F5F0E8] text-sm font-ui-semibold mb-3">
          {title}
        </Text>
      )}

      {/* Scrub bar */}
      <View
        ref={barRef}
        onLayout={e => {
          barWidthRef.current = e.nativeEvent.layout.width;
        }}
        className="h-2 bg-[#272730] rounded-full mb-4 overflow-hidden"
        {...panResponder.panHandlers}
      >
        <Animated.View
          className="h-full bg-[#B8923F] rounded-full"
          style={progressBarStyle}
        />
      </View>

      {/* Time labels */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-[#6B6357] text-xs font-ui">
          {formatTime(currentTime)}
        </Text>
        <Text className="text-[#6B6357] text-xs font-ui">
          -{formatTime(remaining)}
        </Text>
      </View>

      {/* Controls row */}
      <View className="flex-row items-center justify-between">
        {/* Speed control */}
        <TouchableOpacity
          onPress={cycleSpeed}
          className="bg-[#1E1E1E] border border-white/10 rounded-lg px-2.5 py-1.5"
          accessibilityRole="button"
          accessibilityLabel={t('audioGuide.speedLabel', { rate })}
        >
          <Text className="text-[#B8AF9E] text-xs font-ui-semibold">
            {rate}x
          </Text>
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity
          onPress={handlePlayPause}
          className="w-14 h-14 rounded-full bg-[#B8923F] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={
            paused ? t('audioGuide.play') : t('audioGuide.pause')
          }
        >
          {paused ? (
            <Play color="#0A0A0A" size={24} fill="#0A0A0A" />
          ) : (
            <Pause color="#0A0A0A" size={24} fill="#0A0A0A" />
          )}
        </TouchableOpacity>

        {/* Skip 15s */}
        <TouchableOpacity
          onPress={() => {
            const newTime = Math.min(currentTime + 15, duration);
            handleSeek(duration > 0 ? newTime / duration : 0);
          }}
          className="bg-[#1E1E1E] border border-white/10 rounded-lg px-2.5 py-1.5"
          accessibilityRole="button"
          accessibilityLabel={t('audioGuide.skip15')}
        >
          <SkipForward color="#B8AF9E" size={16} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AudioPlayer;
