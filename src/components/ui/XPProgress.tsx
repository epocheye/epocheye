import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS } from '../../core/constants/theme';

interface Props {
  /** Current value (e.g. sites visited). */
  value: number;
  /** Target value (e.g. goal). When <= 0 the bar renders empty. */
  goal: number;
  /** Show the "value / goal" caption above the track. */
  label?: string;
  /** Track height in px. */
  height?: number;
}

/**
 * Slim XP-style progress bar with a sky fill that animates to its width on
 * mount / whenever the ratio changes (reanimated `withTiming`). Used in place of
 * the raw progress bars on Passport / Home / Settings.
 */
const XPProgress: React.FC<Props> = ({ value, goal, label, height = 8 }) => {
  const ratio = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(ratio, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
  }, [ratio, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.wrap}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.count}>
            {value}
            <Text style={styles.goal}> / {goal}</Text>
          </Text>
        </View>
      ) : null}
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View
          style={[styles.fill, { borderRadius: height / 2 }, fillStyle]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  label: { fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textTertiary },
  count: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: COLORS.textPrimary },
  goal: { fontFamily: FONTS.sans, color: COLORS.textTertiary },
  track: {
    width: '100%',
    backgroundColor: COLORS.xpTrack,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: COLORS.sky },
});

export default XPProgress;
