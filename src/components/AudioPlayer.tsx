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

import React, { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ uri, title }) => {
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [isSeeking, setIsSeeking] = useState(false);

  const progress = useSharedValue(0);

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
    <View className="bg-[#141414] border border-[rgba(201,168,76,0.2)] rounded-2xl p-4">
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
        <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-SemiBold'] mb-3">
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
          className="h-full bg-[#D4860A] rounded-full"
          style={progressBarStyle}
        />
      </View>

      {/* Time labels */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular']">
          {formatTime(currentTime)}
        </Text>
        <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular']">
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
          <Text className="text-[#B8AF9E] text-xs font-['MontserratAlternates-SemiBold']">
            {rate}x
          </Text>
        </TouchableOpacity>

        {/* Play/Pause */}
        <TouchableOpacity
          onPress={() => setPaused(p => !p)}
          className="w-14 h-14 rounded-full bg-[#D4860A] items-center justify-center"
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
