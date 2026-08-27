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
   * Start playing on mount instead of waiting for a tap. Defaults to false, so
   * a caller that does not ask for it keeps the tap-to-play player it had.
   *
   * Read ONCE, at mount. A caller that wants a fresh autoplay remounts this
   * component (the audio guide keys it by stop), which is also what resets the
   * scrub bar and the duration; re-reading the prop later would only fight the
   * visitor's own pause.
   */
  autoPlay?: boolean;
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
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  uri,
  title,
  autoPlay = false,
  onPausedChange,
  onLoad,
  onProgress,
  onEnd,
  onError,
}) => {
  const videoRef = useRef<VideoRef>(null);
  /** The clip ran to its end and the player is parked there — see handleEnd. */
  const endedRef = useRef(false);
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
    callbacks.current.onPausedChange?.(paused);
  }, [paused]);

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      if (!isSeeking) {
        setCurrentTime(data.currentTime);
        if (duration > 0) {
          progress.value = withTiming(data.currentTime / duration, {
            duration: 200,
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

  const cycleSpeed = useCallback(() => {
    setRate(prev => {
      const idx = SPEED_OPTIONS.indexOf(prev as (typeof SPEED_OPTIONS)[number]);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  const remaining = duration > 0 ? duration - currentTime : 0;

  // Scrub bar pan responder
  const barRef = useRef<View>(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        barRef.current?.measure((_x, _y, width) => {
          const fraction = evt.nativeEvent.locationX / width;
          handleSeek(fraction);
        });
      },
      onPanResponderMove: (evt) => {
        barRef.current?.measure((_x, _y, width) => {
          const fraction = evt.nativeEvent.locationX / width;
          handleSeek(fraction);
        });
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
        source={{ uri }}
        paused={paused}
        rate={rate}
        onProgress={handleProgress}
        onLoad={handleLoad}
        onEnd={handleEnd}
        onError={handleError}
        playInBackground
        playWhenInactive
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
          accessibilityLabel={`Playback speed ${rate}x`}
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
          accessibilityLabel={paused ? 'Play' : 'Pause'}
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
          accessibilityLabel="Skip 15 seconds"
        >
          <SkipForward color="#B8AF9E" size={16} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AudioPlayer;
