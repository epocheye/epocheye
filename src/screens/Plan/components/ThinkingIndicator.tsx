import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const PHRASES = [
  'Consulting ASI archives…',
  'Cross-referencing UNESCO records…',
  'Reading heritage sources…',
  'Composing your itinerary…',
  'Weaving routes and era…',
  'Pulling verified monument notes…',
];

const SWAP_MS = 2200;

const ThinkingIndicator: React.FC = () => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const opacity = useSharedValue(0);

  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 250 });

    dot1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }, 150);
    setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }, 300);

    timerRef.current = setInterval(() => {
      setPhraseIndex(i => (i + 1) % PHRASES.length);
    }, SWAP_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [opacity, dot1, dot2, dot3]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: 0.3 + dot1.value * 0.7 }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: 0.3 + dot2.value * 0.7 }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: 0.3 + dot3.value * 0.7 }));

  return (
    <Animated.View
      className="flex-row items-center gap-[10px] px-[14px] py-[10px] bg-[#121212] rounded-[14px] self-start border border-[rgba(203,168,98,0.25)]"
      style={[containerStyle, {borderWidth: 0.5}]}
    >
      <View className="flex-row gap-1">
        <Animated.View className="w-[6px] h-[6px] rounded-[3px] bg-accent-amber" style={dot1Style} />
        <Animated.View className="w-[6px] h-[6px] rounded-[3px] bg-accent-amber" style={dot2Style} />
        <Animated.View className="w-[6px] h-[6px] rounded-[3px] bg-accent-amber" style={dot3Style} />
      </View>
      <Text className="text-[#C9A84C] font-montserrat-medium text-[13px]">{PHRASES[phraseIndex]}</Text>
    </Animated.View>
  );
};

export default ThinkingIndicator;
