/**
 * ScanGuideOverlay — the live viewfinder cue layered over the camera on the
 * DetectAr scan screen. Purely cosmetic: it renders no camera, runs no ML, and
 * issues no network calls. It reflects the EXISTING scan state via a single
 * `phase` prop and nothing else drives it.
 *
 * Phases:
 *  • aiming   — resting viewfinder: gently breathing corner brackets + hint.
 *  • scanning — recognition is in flight: a luminous beam runs the frame border
 *               and a gold scan line sweeps top→bottom ("AI is working" motion).
 *  • hit      — a recognition resolved: brackets snap green + a quick lock-on
 *               flash. The parent holds this ~600ms before revealing the card.
 *  • miss     — nothing resolved: brackets dim to neutral + a soft nudge, with a
 *               "move closer / try another angle" hint, then the parent returns
 *               to aiming.
 *
 * Motion is react-native-reanimated (project convention). The root is
 * pointerEvents="none" and the frame is centred well clear of the top controls
 * and the bottom Detect button, so it never blocks the shutter or the feed.
 *
 * NOTE: the app runs on the New Architecture (Fabric). A View with borderRadius
 * + overflow:'hidden' renders its children invisible there, so this component
 * deliberately avoids clipping — every element stays within the frame bounds by
 * construction instead.
 */
import React, {useEffect} from 'react';
import {StyleSheet, View, useWindowDimensions} from 'react-native';
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
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from 'react-i18next';

import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../core/constants/theme';

export type ScanPhase = 'aiming' | 'scanning' | 'hit' | 'miss';

interface ScanGuideOverlayProps {
  phase: ScanPhase;
  /**
   * Native AR tracking readiness. When false, the aiming hint nudges the user to
   * move the phone to map the space first. Defaults to true (2D path has no
   * tracking concept).
   */
  ready?: boolean;
}

const GOLD = COLORS.amber; // #CBA862
const GOLD_TRAIL = 'rgba(203,168,98,0.0)';
const GOLD_CORE = 'rgba(230,200,139,0.95)';
const NEUTRAL = COLORS.textTertiary; // dim parchment
const BRACKET = 26; // corner arm length
const BRACKET_W = 2.5;
const COMET = 90; // length of the travelling border beam

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const ScanGuideOverlay: React.FC<ScanGuideOverlayProps> = ({phase, ready = true}) => {
  const {t} = useTranslation();
  const {width, height} = useWindowDimensions();

  // Frame geometry — a portrait-ish window sized to leave the top row and the
  // bottom Detect button clear. Biased slightly up from centre.
  const frameW = Math.round(Math.min(width * 0.72, 320));
  const frameH = Math.round(Math.min(frameW * 1.18, height * 0.46));

  // Shared values.
  const pulse = useSharedValue(0.6); // bracket breathing (aiming)
  const beam = useSharedValue(0); // perimeter beam progress 0→1 (scanning)
  const sweep = useSharedValue(0); // vertical scan line 0→1 (scanning)
  const hit = useSharedValue(0); // lock-on flash + scale (hit)
  const shake = useSharedValue(0); // soft horizontal nudge (miss)

  useEffect(() => {
    cancelAnimation(pulse);
    cancelAnimation(beam);
    cancelAnimation(sweep);
    cancelAnimation(hit);
    cancelAnimation(shake);

    if (phase === 'aiming') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, {duration: 1200, easing: Easing.inOut(Easing.ease)}),
          withTiming(0.5, {duration: 1200, easing: Easing.inOut(Easing.ease)}),
        ),
        -1,
        true,
      );
    } else if (phase === 'scanning') {
      pulse.value = withTiming(1, {duration: 200});
      beam.value = 0;
      beam.value = withRepeat(
        withTiming(1, {duration: 3200, easing: Easing.linear}),
        -1,
        false,
      );
      sweep.value = 0;
      sweep.value = withRepeat(
        withTiming(1, {duration: 1500, easing: Easing.inOut(Easing.ease)}),
        -1,
        true,
      );
    } else if (phase === 'hit') {
      pulse.value = withTiming(1, {duration: 120});
      hit.value = 0;
      hit.value = withSequence(
        withTiming(1, {duration: 160, easing: Easing.out(Easing.back(2))}),
        withTiming(0, {duration: 440, easing: Easing.inOut(Easing.ease)}),
      );
    } else if (phase === 'miss') {
      pulse.value = withTiming(0.7, {duration: 160});
      shake.value = withSequence(
        withTiming(-1, {duration: 70}),
        withRepeat(withTiming(1, {duration: 110}), 3, true),
        withTiming(0, {duration: 70}),
      );
    }
  }, [phase, pulse, beam, sweep, hit, shake]);

  const isHit = phase === 'hit';
  const isMiss = phase === 'miss';
  const frameColor = isHit ? COLORS.success : isMiss ? NEUTRAL : GOLD;

  // Frame container: breathes on aiming, snaps/scales on hit, nudges on miss.
  const frameStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: shake.value * 6},
      {scale: 1 + hit.value * 0.05},
    ],
  }));

  const bracketStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * pulse.value,
  }));

  // Lock-on flash ring (hit only).
  const flashStyle = useAnimatedStyle(() => ({
    opacity: hit.value * 0.9,
    transform: [{scale: 1 + (1 - hit.value) * 0.12}],
  }));

  // Vertical scan line.
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{translateY: sweep.value * (frameH - 3)}],
    opacity: 0.35 + 0.5 * (1 - Math.abs(sweep.value - 0.5) * 2),
  }));

  // Perimeter beam — one luminous segment travelling the four edges in sequence
  // from a single 0→1 progress value. Each edge owns a quarter of the loop.
  const topBeam = useAnimatedStyle(() => {
    const p = beam.value;
    const active = p < 0.25;
    const l = p / 0.25;
    return {
      opacity: active ? 1 : 0,
      transform: [{translateX: l * (frameW - COMET)}],
    };
  });
  const rightBeam = useAnimatedStyle(() => {
    const p = beam.value;
    const active = p >= 0.25 && p < 0.5;
    const l = (p - 0.25) / 0.25;
    return {
      opacity: active ? 1 : 0,
      transform: [{translateY: l * (frameH - COMET)}],
    };
  });
  const bottomBeam = useAnimatedStyle(() => {
    const p = beam.value;
    const active = p >= 0.5 && p < 0.75;
    const l = (p - 0.5) / 0.25;
    return {
      opacity: active ? 1 : 0,
      transform: [{translateX: (frameW - COMET) * (1 - l)}],
    };
  });
  const leftBeam = useAnimatedStyle(() => {
    const p = beam.value;
    const active = p >= 0.75;
    const l = (p - 0.75) / 0.25;
    return {
      opacity: active ? 1 : 0,
      transform: [{translateY: (frameH - COMET) * (1 - l)}],
    };
  });

  const scanning = phase === 'scanning';
  const label = isMiss
    ? t('lens.nothingRecognized')
    : scanning
      ? t('lens.scanning')
      : ready
        ? t('lens.aimHint')
        : t('lens.hintMove');

  const corners = [styles.tl, styles.tr, styles.bl, styles.br];

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.centre}>
        <Animated.View style={[{width: frameW, height: frameH}, frameStyle]}>
          {/* Corner brackets */}
          {corners.map((pos, i) => (
            <Animated.View
              key={i}
              style={[
                styles.corner,
                pos,
                bracketStyle,
                {borderColor: frameColor},
              ]}
            />
          ))}

          {/* Lock-on flash ring (hit) */}
          {isHit && (
            <Animated.View
              style={[
                styles.flashRing,
                flashStyle,
                {borderColor: COLORS.success},
              ]}
            />
          )}

          {/* Scanning motion: perimeter beam + vertical scan line */}
          {scanning && (
            <>
              <AnimatedLinearGradient
                colors={[GOLD_TRAIL, GOLD_CORE, GOLD_TRAIL]}
                start={{x: 0, y: 0.5}}
                end={{x: 1, y: 0.5}}
                style={[styles.hBeam, styles.hBeamTop, topBeam]}
              />
              <AnimatedLinearGradient
                colors={[GOLD_TRAIL, GOLD_CORE, GOLD_TRAIL]}
                start={{x: 0.5, y: 0}}
                end={{x: 0.5, y: 1}}
                style={[styles.vBeam, styles.vBeamRight, rightBeam]}
              />
              <AnimatedLinearGradient
                colors={[GOLD_TRAIL, GOLD_CORE, GOLD_TRAIL]}
                start={{x: 0, y: 0.5}}
                end={{x: 1, y: 0.5}}
                style={[styles.hBeam, styles.hBeamBottom, bottomBeam]}
              />
              <AnimatedLinearGradient
                colors={[GOLD_TRAIL, GOLD_CORE, GOLD_TRAIL]}
                start={{x: 0.5, y: 0}}
                end={{x: 0.5, y: 1}}
                style={[styles.vBeam, styles.vBeamLeft, leftBeam]}
              />
              <AnimatedLinearGradient
                colors={[GOLD_TRAIL, GOLD, GOLD_TRAIL]}
                start={{x: 0, y: 0.5}}
                end={{x: 1, y: 0.5}}
                style={[styles.scanLine, sweepStyle]}
              />
            </>
          )}
        </Animated.View>

        <Animated.Text
          key={label}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          style={styles.label}>
          {label}
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    // Bias the frame slightly above the vertical centre so it clears the button.
    transform: [{translateY: -28}],
  },
  corner: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
  },
  tl: {top: 0, left: 0, borderTopWidth: BRACKET_W, borderLeftWidth: BRACKET_W, borderTopLeftRadius: RADIUS.sm},
  tr: {top: 0, right: 0, borderTopWidth: BRACKET_W, borderRightWidth: BRACKET_W, borderTopRightRadius: RADIUS.sm},
  bl: {bottom: 0, left: 0, borderBottomWidth: BRACKET_W, borderLeftWidth: BRACKET_W, borderBottomLeftRadius: RADIUS.sm},
  br: {bottom: 0, right: 0, borderBottomWidth: BRACKET_W, borderRightWidth: BRACKET_W, borderBottomRightRadius: RADIUS.sm},
  flashRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: RADIUS.lg,
  },
  hBeam: {
    position: 'absolute',
    width: COMET,
    height: 2.5,
    borderRadius: 2,
  },
  hBeamTop: {top: 0, left: 0},
  hBeamBottom: {bottom: 0, left: 0},
  vBeam: {
    position: 'absolute',
    width: 2.5,
    height: COMET,
    borderRadius: 2,
  },
  vBeamRight: {top: 0, right: 0},
  vBeamLeft: {top: 0, left: 0},
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 2,
    shadowColor: GOLD,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 0},
  },
  label: {
    marginTop: SPACING.xl,
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    maxWidth: 300,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: RADIUS.pill,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
});

export default ScanGuideOverlay;
