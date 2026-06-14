/**
 * ContextLayerSlider — the timeline/context scrubber for a grounded statue card.
 *
 * One labelled tick per context layer (The Moment | When It Was Made | The
 * Tradition). Dragging the thumb drives a shared `progress` value (0…n-1) that
 * the parent card reads to cross-fade the layer body. Snaps to the nearest stop
 * on release with a spring (momentum feel). A floating `period_hint` rides above
 * the thumb, fading in only over the layers that carry a date.
 *
 * Built on react-native-gesture-handler `Gesture.Pan` + reanimated v4 (no built-in
 * `Animated` API, per CLAUDE.md). The same idiom as EraSlider, extended to expose
 * `progress` to the parent for the body cross-fade and to float the period hint.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import type {ContextLayer} from '../../../services/detectorResolver';

interface ContextLayerSliderProps {
  layers: ContextLayer[];
  /** 0…n-1, owned by the parent so it can cross-fade the body off the same value. */
  progress: SharedValue<number>;
  /** Fired on snap/tap with the newly-active layer index (for the per-layer hedge). */
  onActiveChange?: (index: number) => void;
}

const THUMB_SIZE = 18;
const TRACK_HEIGHT = 2;
const SIDE_PAD = THUMB_SIZE / 2;
const LABEL_WIDTH = 96;
const HINT_WIDTH = 150;
const SPRING = {damping: 18, stiffness: 220, mass: 0.9};
const AMBER = '#CBA862';

const ContextLayerSlider: React.FC<ContextLayerSliderProps> = ({
  layers,
  progress,
  onActiveChange,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const stopCount = layers.length;
  const stride = stopCount > 1 ? trackWidth / (stopCount - 1) : 0;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const commit = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(stopCount - 1, i));
      setActiveIndex(clamped);
      onActiveChange?.(clamped);
    },
    [onActiveChange, stopCount],
  );

  const jumpTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(stopCount - 1, i));
      progress.value = withSpring(clamped, SPRING);
      commit(clamped);
    },
    [commit, progress, stopCount],
  );

  const pan = Gesture.Pan()
    .onChange(e => {
      if (stride <= 0) return;
      const next = progress.value + e.changeX / stride;
      progress.value = Math.max(0, Math.min(stopCount - 1, next));
    })
    .onEnd(() => {
      if (stride <= 0) return;
      const snapped = Math.round(progress.value);
      progress.value = withSpring(snapped, SPRING);
      runOnJS(commit)(snapped);
    });

  // Keep the thumb honest if the track is measured/resized after mount.
  useEffect(() => {
    if (trackWidth <= 0 || stopCount <= 1) return;
    progress.value = withSpring(activeIndex, SPRING);
  }, [trackWidth, stopCount, activeIndex, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{translateX: progress.value * stride - THUMB_SIZE / 2}],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, progress.value * stride),
  }));

  return (
    <View style={styles.wrap}>
      {/* Floating period hints — one per dated layer, fading in over its stop. */}
      <View style={[styles.hintRow, {marginHorizontal: SIDE_PAD}]}>
        {layers.map((layer, i) => {
          const hint = (layer.period_hint ?? '').trim();
          if (!hint) return null;
          return (
            <FloatingHint
              key={`hint-${layer.layer_id}`}
              text={hint}
              index={i}
              stride={stride}
              progress={progress}
            />
          );
        })}
      </View>

      <View style={styles.trackOuter}>
        <View style={styles.trackContainer} onLayout={handleLayout}>
          <View style={styles.trackBaseline} />
          <Animated.View style={[styles.trackFill, fillStyle]} />

          {layers.map((layer, i) => (
            <View
              key={`stop-${layer.layer_id}`}
              style={[
                styles.stopMarker,
                {left: i * stride - 4, opacity: i === activeIndex ? 1 : 0.55},
              ]}
            />
          ))}

          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.thumb, thumbStyle]}>
              <View style={styles.thumbInner} />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>

      {/* Tappable labels aligned under each stop. */}
      <View style={[styles.labelRow, {marginHorizontal: SIDE_PAD}]}>
        {layers.map((layer, i) => {
          const isActive = i === activeIndex;
          return (
            <Pressable
              key={`label-${layer.layer_id}`}
              onPress={() => jumpTo(i)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Show layer: ${layer.label}`}
              style={[styles.labelCell, {left: i * stride - LABEL_WIDTH / 2}]}>
              <Text
                numberOfLines={2}
                style={[
                  styles.labelText,
                  isActive ? styles.labelActive : styles.labelInactive,
                ]}>
                {layer.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

/** A single dated label that fades in as the thumb passes its stop. */
const FloatingHint: React.FC<{
  text: string;
  index: number;
  stride: number;
  progress: SharedValue<number>;
}> = ({text, index, stride, progress}) => {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [index - 0.6, index, index + 0.6],
      [0, 1, 0],
      'clamp',
    ),
  }));
  return (
    <Animated.Text
      numberOfLines={2}
      style={[styles.hintText, {left: index * stride - HINT_WIDTH / 2}, style]}>
      {text}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  hintRow: {
    height: 30,
    position: 'relative',
  },
  hintText: {
    position: 'absolute',
    bottom: 0,
    width: HINT_WIDTH,
    textAlign: 'center',
    fontFamily: 'InstrumentSans-Medium',
    fontSize: 11,
    lineHeight: 14,
    color: AMBER,
  },
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
    height: 34,
    position: 'relative',
  },
  labelCell: {
    position: 'absolute',
    top: 0,
    width: LABEL_WIDTH,
    alignItems: 'center',
    paddingVertical: 2,
  },
  labelText: {
    fontFamily: 'InstrumentSans-Medium',
    fontSize: 11.5,
    lineHeight: 14,
    textAlign: 'center',
  },
  labelActive: {
    color: AMBER,
  },
  labelInactive: {
    color: 'rgba(255,255,255,0.45)',
  },
});

export default ContextLayerSlider;
