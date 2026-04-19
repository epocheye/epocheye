import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface Particle {
  id: number;
  startX: number;
  size: number;
  color: string;
  opacity: number;
  duration: number;
  sway: number;
  delay: number;
}

const GOLD_COLOR = 'rgba(201,168,76,0.20)';
const INDIGO_COLOR = 'rgba(139,159,232,0.12)';

function generate(): Particle[] {
  const particles: Particle[] = [];
  // 6 gold + 4 indigo
  for (let i = 0; i < 10; i++) {
    const isIndigo = i >= 6;
    particles.push({
      id: i,
      startX: Math.random() * 100,
      size: 1.5 + Math.random() * 2,
      color: isIndigo ? INDIGO_COLOR : GOLD_COLOR,
      opacity: 0.5 + Math.random() * 0.5,
      duration: 8000 + Math.random() * 6000,
      sway: (Math.random() - 0.5) * 160,
      delay: Math.random() * 5000,
    });
  }
  return particles;
}

const PARTICLES = generate();

const DustMote: React.FC<{p: Particle}> = ({p}) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      p.delay,
      withRepeat(
        withTiming(-500, {duration: p.duration, easing: Easing.linear}),
        -1,
        false,
      ),
    );
    translateX.value = withDelay(
      p.delay,
      withRepeat(
        withTiming(p.sway, {duration: p.duration, easing: Easing.linear}),
        -1,
        true,
      ),
    );
  }, [translateY, translateX, p.delay, p.duration, p.sway]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: translateY.value},
      {translateX: translateX.value},
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.mote,
        animatedStyle,
        {
          left: `${p.startX}%`,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          backgroundColor: p.color,
          opacity: p.opacity,
        },
      ]}
    />
  );
};

const DustMotes: React.FC = () => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PARTICLES.map(p => (
        <DustMote key={p.id} p={p} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  mote: {
    position: 'absolute',
    bottom: -10,
  },
});

export default DustMotes;
