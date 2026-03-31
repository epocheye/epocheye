import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface ThinkingDotsProps {
  messages: string[];
  color?: string;
}

const DOT_CYCLE_MS = 600;
const MESSAGE_CYCLE_MS = DOT_CYCLE_MS * 4; // 4 steps: 1 dot, 2 dots, 3 dots, pause

const ThinkingDots: React.FC<ThinkingDotsProps> = ({
  messages,
  color = '#C9A84C',
}) => {
  const [messageIndex, setMessageIndex] = useState(0);

  // Each dot fades in on a staggered schedule, then all fade out together.
  // Full cycle: 600ms × 4 = 2400ms
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const onCycle = withSequence(
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: DOT_CYCLE_MS * 2 }), // hold
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 60 }), // gap before next cycle
    );

    dot1.value = withRepeat(onCycle, -1, false);
    dot2.value = withRepeat(withDelay(DOT_CYCLE_MS, onCycle), -1, false);
    dot3.value = withRepeat(withDelay(DOT_CYCLE_MS * 2, onCycle), -1, false);
  }, [dot1, dot2, dot3]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, MESSAGE_CYCLE_MS * 1.5);
    return () => clearInterval(timer);
  }, [messages.length]);

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

  const dotSize = 7;

  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-row items-center gap-[5px]">
        <Animated.View
          style={[
            dot1Style,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
          ]}
        />
        <Animated.View
          style={[
            dot2Style,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
          ]}
        />
        <Animated.View
          style={[
            dot3Style,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
          ]}
        />
      </View>
      <Text
        style={{ color, fontFamily: 'MontserratAlternates-Medium', fontSize: 13, lineHeight: 18 }}
      >
        {messages[messageIndex]}
      </Text>
    </View>
  );
};

export default ThinkingDots;
