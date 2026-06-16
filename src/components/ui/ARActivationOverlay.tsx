/**
 * ARActivationOverlay — a cinematic full-screen "takeover" that plays once when
 * the AR camera activates, then dissolves to reveal the live feed. Evokes a
 * browser-extension / HUD taking over the screen: a dim veil, corner brackets
 * sweeping in, a gold scan line sweeping the frame, a faint grid materialising,
 * a center reticle, and status text stepping Initializing → Mapping → Ready.
 *
 * All motion uses react-native-reanimated (project convention). Self-completing:
 * call with `visible`, get `onDone` when the sequence + dissolve finish.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Dimensions, StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {FONTS} from '../../core/constants/theme';

const GOLD = '#CBA862';
const GOLD_SOFT = 'rgba(203,168,98,0.55)';
const GOLD_FAINT = 'rgba(203,168,98,0.14)';
const {height: H} = Dimensions.get('window');

// Scan sweeps between these vertical bounds (keeps it inside the visible frame).
const FRAME_TOP = H * 0.14;
const FRAME_BOTTOM = H * 0.82;

const STEPS = ['Initializing AR', 'Mapping surroundings', 'Ready'] as const;

interface Props {
  /** When true, the sequence plays from the start. */
  visible: boolean;
  /** Called once the sequence + dissolve complete. */
  onDone?: () => void;
  /** Small eyebrow above the status line (e.g. "AR Lens"). */
  title?: string;
  /** Venue / site name shown under the status line. */
  subtitle?: string;
}

type CornerKey = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_STYLE: Record<CornerKey, object> = {
  tl: {top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 10},
  tr: {top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 10},
  bl: {bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 10},
  br: {bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 10},
};

const ARActivationOverlay: React.FC<Props> = ({visible, onDone, title = 'AR Lens', subtitle}) => {
  const master = useSharedValue(0); // overall fade in/out
  const corners = useSharedValue(0); // bracket sweep-in
  const grid = useSharedValue(0); // grid + reticle materialise
  const scan = useSharedValue(0); // 0→1 sweep, repeated
  const reticle = useSharedValue(0); // reticle breathe

  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(visible);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setMounted(true);
    setStep(0);

    // Reset
    master.value = 0;
    corners.value = 0;
    grid.value = 0;
    scan.value = 0;

    master.value = withTiming(1, {duration: 260, easing: Easing.out(Easing.quad)});
    corners.value = withDelay(
      200,
      withTiming(1, {duration: 460, easing: Easing.out(Easing.back(1.6))}),
    );
    grid.value = withDelay(480, withTiming(1, {duration: 620, easing: Easing.out(Easing.quad)}));
    scan.value = withDelay(
      360,
      withRepeat(withTiming(1, {duration: 1150, easing: Easing.inOut(Easing.ease)}), 2, false),
    );
    reticle.value = withDelay(
      520,
      withRepeat(withTiming(1, {duration: 900, easing: Easing.inOut(Easing.ease)}), -1, true),
    );

    // Status text steps.
    timers.current.push(setTimeout(() => setStep(1), 1080));
    timers.current.push(setTimeout(() => setStep(2), 1950));

    // Dissolve + hand back control.
    timers.current.push(
      setTimeout(() => {
        cancelAnimation(reticle);
        master.value = withTiming(0, {duration: 380, easing: Easing.in(Easing.quad)}, finished => {
          if (finished) {
            runOnJS(setMounted)(false);
            if (onDone) runOnJS(onDone)();
          }
        });
      }, 2480),
    );

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      cancelAnimation(reticle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const rootStyle = useAnimatedStyle(() => ({opacity: master.value}));
  const cornerStyle = useAnimatedStyle(() => ({
    opacity: corners.value,
    transform: [{scale: 0.82 + corners.value * 0.18}],
  }));
  const gridStyle = useAnimatedStyle(() => ({opacity: grid.value * 0.5}));
  const scanStyle = useAnimatedStyle(() => ({
    opacity: scan.value > 0 && scan.value < 1 ? 1 : scan.value === 0 ? 0 : 0.4,
    transform: [{translateY: FRAME_TOP + scan.value * (FRAME_BOTTOM - FRAME_TOP)}],
  }));
  const reticleStyle = useAnimatedStyle(() => ({
    opacity: grid.value,
    transform: [{scale: 0.94 + reticle.value * 0.12}],
  }));
  const statusStyle = useAnimatedStyle(() => ({opacity: grid.value}));

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="none">
      {/* Dim veil so the boot UI reads over the live feed */}
      <View style={styles.veil} />

      {/* Faint materialising grid */}
      <Animated.View style={[StyleSheet.absoluteFill, gridStyle]}>
        {Array.from({length: 7}).map((_, i) => (
          <View key={`h${i}`} style={[styles.hline, {top: `${(i + 1) * 12.5}%`}]} />
        ))}
        {Array.from({length: 5}).map((_, i) => (
          <View key={`v${i}`} style={[styles.vline, {left: `${(i + 1) * 16.6}%`}]} />
        ))}
      </Animated.View>

      {/* Corner brackets */}
      <Animated.View style={[styles.frame, cornerStyle]}>
        {(Object.keys(CORNER_STYLE) as CornerKey[]).map(k => (
          <View key={k} style={[styles.corner, CORNER_STYLE[k]]} />
        ))}
      </Animated.View>

      {/* Center reticle */}
      <Animated.View style={[styles.reticleWrap, reticleStyle]} pointerEvents="none">
        <View style={styles.reticleRing} />
        <View style={styles.reticleDot} />
        <View style={[styles.tick, {top: -14}]} />
        <View style={[styles.tick, {bottom: -14}]} />
        <View style={[styles.tickH, {left: -14}]} />
        <View style={[styles.tickH, {right: -14}]} />
      </Animated.View>

      {/* Sweeping scan line */}
      <Animated.View style={[styles.scanWrap, scanStyle]}>
        <LinearGradient
          colors={['transparent', GOLD_SOFT, GOLD, GOLD_SOFT, 'transparent']}
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={styles.scanLine}
        />
        <LinearGradient
          colors={[GOLD_FAINT, 'transparent']}
          start={{x: 0.5, y: 0}}
          end={{x: 0.5, y: 1}}
          style={styles.scanGlow}
        />
      </Animated.View>

      {/* Status block */}
      <Animated.View style={[styles.status, statusStyle]}>
        <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{STEPS[step]}</Text>
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.track}>
          <View style={[styles.trackFill, {width: `${((step + 1) / STEPS.length) * 100}%`}]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {zIndex: 60, elevation: 60, alignItems: 'center', justifyContent: 'center'},
  veil: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,12,0.42)'},
  hline: {position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: GOLD_FAINT},
  vline: {position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: GOLD_FAINT},
  frame: {
    position: 'absolute',
    top: FRAME_TOP,
    bottom: H - FRAME_BOTTOM,
    left: 24,
    right: 24,
  },
  corner: {position: 'absolute', width: 38, height: 38, borderColor: GOLD},
  reticleWrap: {position: 'absolute', width: 56, height: 56, alignItems: 'center', justifyContent: 'center'},
  reticleRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
  },
  reticleDot: {width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD},
  tick: {position: 'absolute', width: 1.5, height: 9, backgroundColor: GOLD},
  tickH: {position: 'absolute', width: 9, height: 1.5, backgroundColor: GOLD},
  scanWrap: {position: 'absolute', top: 0, left: 24, right: 24, height: 2},
  scanLine: {height: 2, borderRadius: 2, width: '100%'},
  scanGlow: {position: 'absolute', top: 2, left: 0, right: 0, height: 56},
  status: {position: 'absolute', bottom: H * 0.12, alignItems: 'center'},
  eyebrow: {fontFamily: FONTS.uiSemiBold, fontSize: 10, letterSpacing: 3, color: GOLD},
  statusRow: {flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8},
  statusDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD},
  statusText: {fontFamily: FONTS.display, fontSize: 20, color: '#F4EFE7'},
  subtitle: {fontFamily: FONTS.ui, fontSize: 13, color: 'rgba(244,239,231,0.6)', marginTop: 4},
  track: {marginTop: 14, width: 160, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden'},
  trackFill: {height: '100%', borderRadius: 2, backgroundColor: GOLD},
});

export default ARActivationOverlay;
