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
import type { OnLoadData, OnProgressData, VideoRef } from 'react-native-video';
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
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  uri,
  title,
  autoPlay = false,
  sourceKey,
}) => {
  const trackKey = sourceKey ?? uri;
  const { t } = useTranslation();
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);

  const progress = useSharedValue(0);

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
  // rewind the native player, which a same-URL swap won't do on its own.
  const prevUriRef = useRef(uri);
  useEffect(() => {
    setCurrentTime(0);
    setIsSeeking(false);
    progress.value = 0;
    setPaused(!autoPlay);
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
            duration: 200,
          });
        }
      }
    },
    [duration, isSeeking, progress],
  );

  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
  }, []);

  const handleEnd = useCallback(() => {
    setPaused(true);
    setCurrentTime(0);
    progress.value = withTiming(0, { duration: 200 });
  }, [progress]);

  const handleSeek = useCallback(
    (fraction: number) => {
      const seekTime = Math.max(0, Math.min(1, fraction)) * duration;
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
        source={{ uri }}
        paused={paused}
        rate={rate}
        onProgress={handleProgress}
        onLoad={handleLoad}
        onEnd={handleEnd}
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
          onPress={() => setPaused(p => !p)}
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
