import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { COLORS, FONTS } from '../../core/constants/theme';

interface Props {
  /** XP amount to celebrate. */
  amount: number;
  /** Drives the one-shot animation when it flips to true. */
  visible: boolean;
  /** Fired after the toast finishes its exit. */
  onDone?: () => void;
  /** Override the trailing word (default "XP"). */
  unit?: string;
}

/**
 * Floating "+50 XP" reward pill that pops in, holds, and fades out. Reanimated
 * per project convention. Mount it near the top of a screen and toggle `visible`
 * when XP is earned (e.g. after claiming the daily fact or arriving on site).
 */
const XPGainToast: React.FC<Props> = ({ amount, visible, onDone, unit = 'XP' }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (!visible) {
      return;
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
      withDelay(
        1400,
        withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) }, finished => {
          if (finished && onDone) {
            runOnJS(onDone)();
          }
        }),
      ),
    );
    translateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.back(1.4)) });
    scale.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) });
  }, [visible, amount, opacity, translateY, scale, onDone]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
      <View style={styles.pill}>
        <Sparkles color={COLORS.bg} size={15} fill={COLORS.bg} />
        <Text style={styles.text}>
          +{amount} {unit}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 40,
    backgroundColor: COLORS.gold,
  },
  text: { fontFamily: FONTS.uiMedium, fontSize: 14, color: COLORS.bg },
});

export default XPGainToast;
