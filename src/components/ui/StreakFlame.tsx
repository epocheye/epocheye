import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { COLORS, FONTS } from '../../core/constants/theme';

interface Props {
  /** Current streak length in days. */
  days: number;
  /** Glyph size; the count scales with it. */
  size?: number;
  /** Optional trailing label (e.g. "day streak"). */
  label?: string;
}

/**
 * Gamified streak indicator: a flame that breathes (soft looping pulse) next to
 * the day count. Animation uses react-native-reanimated per project convention.
 * When days <= 0 the flame renders dim and still (no streak to celebrate yet).
 */
const StreakFlame: React.FC<Props> = ({ days, size = 22, label }) => {
  const active = days > 0;
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.14, { duration: 720, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 720, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const tint = active ? COLORS.sky : COLORS.textMuted;

  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={`${days} day streak`}>
      <Animated.View style={flameStyle}>
        <Flame color={tint} size={size} fill={active ? COLORS.skyGlow : 'transparent'} />
      </Animated.View>
      <Text style={[styles.count, { fontSize: size * 0.86, color: tint }]}>{days}</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { fontFamily: FONTS.serif },
  label: {
    marginLeft: 2,
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});

export default StreakFlame;
