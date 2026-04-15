import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  className?: string;
  style?: ViewStyle;
}

/**
 * Heritage-dark shimmer skeleton. A moving gold-tinted highlight sweeps
 * across a surface-1 base. Uses Reanimated (not the built-in Animated)
 * and matches CLAUDE.md's "skeleton screens, never spinners" rule.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  className,
  style,
}: SkeletonProps) {
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 180 }],
  }));

  return (
    <View
      className={className}
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: '#141414',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[{ flex: 1, width: '60%' }, animatedStyle]}>
        <LinearGradient
          colors={[
            'rgba(201,168,76,0)',
            'rgba(201,168,76,0.12)',
            'rgba(201,168,76,0)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

export default Skeleton;
