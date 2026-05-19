import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

interface PulsingRingProps {
  matched: boolean;
  onMatchAnimationComplete?: () => void;
}

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
} as const;

const PulsingRing: React.FC<PulsingRingProps> = ({
  matched,
  onMatchAnimationComplete,
}) => {
  const [showRipple, setShowRipple] = useState(false);
  const hasAnimatedMatch = useRef(false);

  const pulseOpacity = useSharedValue(0.6);
  const flashOpacity = useSharedValue(0);
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);

  useEffect(() => {
    if (matched) {
      cancelAnimation(pulseOpacity);
      return;
    }

    hasAnimatedMatch.current = false;
    setShowRipple(false);
    pulseOpacity.value = 0.6;
    flashOpacity.value = 0;
    rippleScale.value = 1;
    rippleOpacity.value = 0;

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, {duration: 1200, easing: Easing.inOut(Easing.ease)}),
        withTiming(0.6, {duration: 1200, easing: Easing.inOut(Easing.ease)}),
      ),
      -1,
      false,
    );
  }, [flashOpacity, matched, pulseOpacity, rippleOpacity, rippleScale]);

  useEffect(() => {
    if (!matched || hasAnimatedMatch.current) {
      return;
    }

    hasAnimatedMatch.current = true;

    try {
      ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS);
    } catch {
      // Haptics are best-effort and should never block animation.
    }

    cancelAnimation(pulseOpacity);
    pulseOpacity.value = withTiming(0, {duration: 150});

    flashOpacity.value = withSequence(
      withTiming(1, {duration: 120}),
      withTiming(0, {duration: 300}),
    );

    setShowRipple(true);
    rippleScale.value = 1;
    rippleOpacity.value = 1;

    rippleScale.value = withTiming(2.2, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    rippleOpacity.value = withTiming(
      0,
      {duration: 600, easing: Easing.out(Easing.cubic)},
      finished => {
        if (finished) {
          runOnJS(setShowRipple)(false);
          if (onMatchAnimationComplete) {
            runOnJS(onMatchAnimationComplete)();
          }
        }
      },
    );
  }, [
    flashOpacity,
    matched,
    onMatchAnimationComplete,
    pulseOpacity,
    rippleOpacity,
    rippleScale,
  ]);

  const pulseStyle = useAnimatedStyle(() => ({opacity: pulseOpacity.value}));
  const flashStyle = useAnimatedStyle(() => ({opacity: flashOpacity.value}));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: rippleOpacity.value,
    transform: [{scale: rippleScale.value}],
  }));

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      {/* Ring shape requires static dimensions + border — className + animated opacity */}
      <Animated.View className="absolute w-[72px] h-[72px] rounded-full border-2 border-accent-amber bg-transparent" style={pulseStyle} />
      <Animated.View className="absolute w-[72px] h-[72px] rounded-full border-2 border-accent-amber bg-transparent" style={flashStyle} />
      {showRipple ? (
        <Animated.View className="absolute w-[72px] h-[72px] rounded-full border-2 border-accent-amber bg-transparent" style={rippleStyle} />
      ) : null}
    </View>
  );
};

export default PulsingRing;
