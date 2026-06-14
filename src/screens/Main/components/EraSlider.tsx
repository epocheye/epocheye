/**
 * EraSlider — horizontal snap slider for the AR experience shell.
 *
 * Renders one stop per `EraModel`, with a draggable thumb that snaps to
 * the nearest stop on release. Each stop label is also a Pressable so the
 * user can tap to jump. Built on react-native-gesture-handler `Gesture.Pan`
 * + reanimated v4 — no built-in `Animated` API, per CLAUDE.md.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type {EraModel} from './eraModels';

interface EraSliderProps {
  eras: EraModel[];
  activeIndex: number;
  onChangeIndex: (i: number) => void;
}

const THUMB_SIZE = 16;
const TRACK_HEIGHT = 2;
const SIDE_PAD = THUMB_SIZE / 2;
const LABEL_WIDTH = 72;
const SPRING = {damping: 18, stiffness: 220, mass: 0.9};
const AMBER = '#CBA862';

const EraSlider: React.FC<EraSliderProps> = ({eras, activeIndex, onChangeIndex}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const stopCount = eras.length;
  const stride = stopCount > 1 ? trackWidth / (stopCount - 1) : 0;

  useEffect(() => {
    if (trackWidth <= 0 || stopCount <= 1) return;
    translateX.value = withSpring(activeIndex * stride, SPRING);
  }, [activeIndex, stopCount, stride, trackWidth, translateX]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const snapTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(stopCount - 1, i));
      if (clamped !== activeIndex) {
        onChangeIndex(clamped);
      }
    },
    [activeIndex, onChangeIndex, stopCount],
  );

  const pan = Gesture.Pan()
    .onChange(e => {
      if (trackWidth <= 0) return;
      const next = Math.max(0, Math.min(trackWidth, translateX.value + e.changeX));
      translateX.value = next;
    })
    .onEnd(() => {
      if (trackWidth <= 0 || stopCount <= 1) return;
      const rawIndex = translateX.value / stride;
      const snapped = Math.round(rawIndex);
      translateX.value = withSpring(snapped * stride, SPRING);
      runOnJS(snapTo)(snapped);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value - THUMB_SIZE / 2}],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, translateX.value),
  }));

  return (
    <View>
      <View style={styles.trackOuter}>
        <View style={styles.trackContainer} onLayout={handleLayout}>
          <View style={styles.trackBaseline} />
          <Animated.View style={[styles.trackFill, fillStyle]} />

          {eras.map((era, i) => {
            const isActive = i === activeIndex;
            return (
              <View
                key={era.year}
                style={[
                  styles.stopMarker,
                  {left: i * stride - 4, opacity: isActive ? 1 : 0.55},
                ]}
              />
            );
          })}

          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.thumb, thumbStyle]}>
              <View style={styles.thumbInner} />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>

      {/* Labels aligned with stops using absolute positioning */}
      <View style={[styles.labelRow, {marginHorizontal: SIDE_PAD}]}>
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          return (
            <Pressable
              key={era.year}
              onPress={() => snapTo(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${era.label}`}
              style={[
                styles.labelCell,
                {left: i * stride - LABEL_WIDTH / 2},
              ]}>
              <Text
                style={[
                  styles.labelText,
                  isActive ? styles.labelActive : styles.labelInactive,
                ]}>
                {era.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  trackOuter: {
    paddingHorizontal: SIDE_PAD,
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
  },
  trackContainer: {
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
  },
  trackBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT,
    backgroundColor: AMBER,
  },
  stopMarker: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    top: '50%',
    marginTop: -4,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: AMBER,
    top: '50%',
    marginTop: -THUMB_SIZE / 2,
    shadowColor: AMBER,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 0},
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1A0F00',
  },
  labelRow: {
    marginTop: 10,
    height: 22,
    position: 'relative',
  },
  labelCell: {
    position: 'absolute',
    top: 0,
    width: LABEL_WIDTH,
    alignItems: 'center',
    paddingVertical: 4,
  },
  labelText: {
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 12,
  },
  labelActive: {
    color: AMBER,
  },
  labelInactive: {
    color: 'rgba(255,255,255,0.45)',
  },
});

export default EraSlider;
