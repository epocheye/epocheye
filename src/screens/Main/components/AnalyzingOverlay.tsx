/**
 * AnalyzingOverlay — the masked "the app is studying this piece" sequence shown
 * while the recognition agent runs on a cache miss (~8–15s).
 *
 * The point: a miss must never read as dead loading. We lock a reticle onto the
 * framed object, sweep a scan line across it, and advance evocative copy on a
 * timer — so the wait feels like deliberate examination. Copy is decorative (we
 * return a single result), not tied to backend stages.
 *
 * Built on react-native-reanimated; no spinners. Reusable over either the native
 * AR view or the 2D camera.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../../core/constants/theme';

const RETICLE = 248;
const STAGES = [
  'Framing the piece…',
  'Reading the iconography…',
  'Consulting the museum record…',
  'Composing what we found…',
];
const STAGE_MS = 2600;

interface AnalyzingOverlayProps {
  visible: boolean;
}

const AnalyzingOverlay: React.FC<AnalyzingOverlayProps> = ({visible}) => {
  const {width} = useWindowDimensions();
  const [stage, setStage] = useState(0);

  const sweep = useSharedValue(0);
  const reticle = useSharedValue(0.9);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(sweep);
      cancelAnimation(reticle);
      setStage(0);
      return;
    }
    // Scan line travels top→bottom of the reticle, repeating.
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, {duration: 1700, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
    // Reticle breathes subtly.
    reticle.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 1100, easing: Easing.inOut(Easing.ease)}),
        withTiming(0.85, {duration: 1100, easing: Easing.inOut(Easing.ease)}),
      ),
      -1,
      true,
    );

    const id = setInterval(
      () => setStage(s => (s + 1) % STAGES.length),
      STAGE_MS,
    );
    return () => clearInterval(id);
  }, [visible, sweep, reticle]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{translateY: sweep.value * (RETICLE - 4)}],
    opacity: 0.35 + 0.45 * (1 - Math.abs(sweep.value - 0.5) * 2),
  }));
  const reticleStyle = useAnimatedStyle(() => ({opacity: reticle.value}));

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(220)}
      pointerEvents="none"
      style={styles.root}>
      <View style={[styles.reticle, {width: RETICLE, height: RETICLE}]}>
        {/* Four corner brackets */}
        <Animated.View style={[styles.corner, styles.tl, reticleStyle]} />
        <Animated.View style={[styles.corner, styles.tr, reticleStyle]} />
        <Animated.View style={[styles.corner, styles.bl, reticleStyle]} />
        <Animated.View style={[styles.corner, styles.br, reticleStyle]} />
        {/* Scan line */}
        <Animated.View style={[styles.scanLine, sweepStyle]} />
      </View>

      <Animated.Text
        key={stage}
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(300)}
        style={[styles.stageText, {maxWidth: width * 0.8}]}>
        {STAGES[stage]}
      </Animated.Text>
    </Animated.View>
  );
};

const CORNER = 30;
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden'},
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: COLORS.sky,
  },
  tl: {top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2},
  tr: {top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2},
  bl: {bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2},
  br: {bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2},
  scanLine: {
    width: RETICLE - 24,
    height: 2,
    backgroundColor: COLORS.sky,
    shadowColor: COLORS.sky,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 0},
  },
  stageText: {
    marginTop: SPACING.section,
    fontFamily: FONTS.serifItalic,
    fontSize: FONT_SIZES.subtitle,
    color: COLORS.textPrimary,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 8,
  },
});

export default AnalyzingOverlay;
