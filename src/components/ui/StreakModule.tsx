import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Flame } from 'lucide-react-native';
import { COLORS, FONTS, GOLD_GRADIENT } from '../../core/constants/theme';

interface Props {
  /** Current streak length in days. */
  days: number;
  /**
   * Optional 7-slot week pattern (true = a day with activity). When omitted it
   * fills the most recent `days % 7 || (days ? 7 : 0)` slots.
   */
  week?: boolean[];
  /** Helper line under the count. */
  subtitle?: string;
}

function defaultWeek(days: number): boolean[] {
  const filled = days <= 0 ? 0 : ((days - 1) % 7) + 1;
  return Array.from({ length: 7 }, (_, i) => i < filled);
}

/**
 * Premium hero streak card: a gold-gradient panel with a breathing flame, the
 * day count in display serif, and a 7-day dot trail. Animation uses reanimated
 * per project convention.
 */
const StreakModule: React.FC<Props> = ({ days, week, subtitle }) => {
  const active = days > 0;
  const pulse = useSharedValue(1);
  const slots = week ?? defaultWeek(days);

  useEffect(() => {
    if (!active) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 760, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 760, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <LinearGradient
      colors={GOLD_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.iconWrap}>
        <Animated.View style={flameStyle}>
          <Flame color={COLORS.textPrimary} size={26} fill={COLORS.textPrimary} />
        </Animated.View>
      </View>
      <View style={styles.body}>
        <Text style={styles.count}>
          {days}
          <Text style={styles.countUnit}> day{days === 1 ? '' : 's'}</Text>
        </Text>
        <Text style={styles.subtitle}>{subtitle ?? 'Keep your streak alive'}</Text>
      </View>
      <View style={styles.dots}>
        {slots.map((on, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: on ? COLORS.textPrimary : 'rgba(10,10,12,0.3)' }]}
          />
        ))}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.18)',
  },
  body: { flex: 1, gap: 2 },
  count: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.textPrimary, lineHeight: 30 },
  countUnit: { fontFamily: FONTS.uiMedium, fontSize: 14, color: 'rgba(244,239,231,0.85)' },
  subtitle: { fontFamily: FONTS.ui, fontSize: 12, color: 'rgba(244,239,231,0.8)' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

export default StreakModule;
