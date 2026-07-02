/**
 * AiThinking — animated "processing" visuals for the AI Guide.
 *
 * Two reusable, reanimated-driven pieces:
 *   - `AnimatedWaveform`  — a row of gold bars that dance in a staggered loop.
 *                           `active` runs the loop; `variant` sets the energy:
 *                           'thinking' (tall, lively) vs 'calm' (short, gentle
 *                           breathing under a delivered answer).
 *   - `AiThinkingIndicator` — the redesigned thinking bubble: EPOCHEYE AI label,
 *                           the lively waveform as the hero motion, a cycling
 *                           heritage-voice status line, and a trailing pulse of
 *                           dots. Wrapped in a soft gold glow (brand rule: glow,
 *                           not drop shadow).
 *
 * All loops start on mount and are cancelled on unmount; the status-line timers
 * are cleared on unmount. Pure presentational — no data or navigation.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

const FLAME = '#CBA862';

// Fallback phrases if i18n `guide.thinkingPhrases` is missing / not an array.
const FALLBACK_PHRASES = [
  'Consulting the archives…',
  'Reading the inscriptions…',
  'Tracing the dynasty…',
  'Piecing together the story…',
];

type WaveVariant = 'thinking' | 'calm';

interface AnimatedWaveformProps {
  active?: boolean;
  variant?: WaveVariant;
  /** Number of bars. */
  bars?: number;
}

const VARIANTS: Record<
  WaveVariant,
  { min: number; max: number; duration: number; stagger: number; barColor: string }
> = {
  thinking: { min: 5, max: 20, duration: 460, stagger: 90, barColor: FLAME },
  calm: { min: 4, max: 12, duration: 900, stagger: 130, barColor: 'rgba(203,168,98,0.55)' },
};

/** One bar; height oscillates between `min` and `max` on a looped timer. */
const WaveBar: React.FC<{
  min: number;
  max: number;
  duration: number;
  delay: number;
  color: string;
  active: boolean;
}> = ({ min, max, duration, delay, color, active }) => {
  const h = useSharedValue(min);

  useEffect(() => {
    if (active) {
      h.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(max, { duration, easing: Easing.inOut(Easing.quad) }),
            withTiming(min, { duration, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(min, { duration: 200 });
    }
    return () => cancelAnimation(h);
  }, [active, h, min, max, duration, delay]);

  const style = useAnimatedStyle(() => ({ height: h.value }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
};

export const AnimatedWaveform: React.FC<AnimatedWaveformProps> = ({
  active = true,
  variant = 'thinking',
  bars = 7,
}) => {
  const cfg = VARIANTS[variant];
  const indices = useMemo(() => Array.from({ length: bars }, (_, i) => i), [bars]);

  return (
    <View
      style={styles.wave}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {indices.map(i => (
        <WaveBar
          key={i}
          min={cfg.min}
          max={cfg.max}
          duration={cfg.duration}
          delay={i * cfg.stagger}
          color={cfg.barColor}
          active={active}
        />
      ))}
    </View>
  );
};

/** A single pulsing dot driven by an externally-owned shared value. */
const Dot: React.FC<{ v: SharedValue<number> }> = ({ v }) => {
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.75 + v.value * 0.35 }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
};

/** Three dots that pulse in a staggered loop (trailing "typing" accent). */
const PulseDots: React.FC = () => {
  const a = useSharedValue(0.3);
  const b = useSharedValue(0.3);
  const c = useSharedValue(0.3);

  useEffect(() => {
    const dots = [a, b, c];
    dots.forEach((v, i) => {
      v.value = withDelay(
        i * 180,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.3, { duration: 380, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        ),
      );
    });
    return () => dots.forEach(v => cancelAnimation(v));
  }, [a, b, c]);

  return (
    <View style={styles.dotsRow}>
      <Dot v={a} />
      <Dot v={b} />
      <Dot v={c} />
    </View>
  );
};

export const AiThinkingIndicator: React.FC = () => {
  const { t } = useTranslation();

  const phrases = useMemo<string[]>(() => {
    const raw = t('guide.thinkingPhrases', { returnObjects: true }) as unknown;
    return Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : FALLBACK_PHRASES;
  }, [t]);

  const [phraseIndex, setPhraseIndex] = useState(0);
  const fade = useSharedValue(1);
  const indexRef = useRef(0);

  useEffect(() => {
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    const cycle = setInterval(() => {
      // Fade out, then back in; swap the text at the fade's midpoint so it never
      // flickers between two visible phrases.
      fade.value = withTiming(0, { duration: 260 }, finished => {
        'worklet';
        if (finished) {
          fade.value = withTiming(1, { duration: 320 });
        }
      });
      swapTimer = setTimeout(() => {
        indexRef.current = (indexRef.current + 1) % phrases.length;
        setPhraseIndex(indexRef.current);
      }, 260);
    }, 2200);

    return () => {
      clearInterval(cycle);
      if (swapTimer) clearTimeout(swapTimer);
    };
  }, [fade, phrases.length]);

  const textStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <View style={styles.labelRow}>
          <Sparkles size={11} color={FLAME} />
          <Text style={styles.label}>EPOCHEYE AI</Text>
        </View>

        <View style={styles.body}>
          <AnimatedWaveform active variant="thinking" bars={7} />
          <Animated.Text style={[styles.status, textStyle]} numberOfLines={1}>
            {phrases[phraseIndex]}
          </Animated.Text>
          <PulseDots />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 22,
    alignSelf: 'flex-start',
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  wrap: {
    alignItems: 'flex-start',
    maxWidth: '94%',
  },
  bubble: {
    backgroundColor: '#131218',
    borderWidth: 1,
    borderColor: 'rgba(203,168,98,0.30)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    // Soft gold glow (brand rule: glow, not drop shadow).
    shadowColor: FLAME,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 10,
    color: FLAME,
    letterSpacing: 0.8,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  status: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    color: '#D9CDB8',
    fontStyle: 'italic',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: FLAME,
  },
});
