import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { FONTS } from '../../../core/constants/theme';

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
    <Animated.View style={[styles.row, containerStyle]}>
      <View style={styles.dots}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
        <Animated.View style={[styles.dot, dot3Style]} />
      </View>
      <Text style={styles.phrase}>{PHRASES[phraseIndex]}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#121212',
    borderRadius: 14,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,160,32,0.25)',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E8A020',
  },
  phrase: {
    color: '#C9A84C',
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
});

export default ThinkingIndicator;
