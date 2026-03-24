import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const PARTICLE_COUNT = 14;

interface Particle {
  id: number;
  startX: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

/** Generate particle configs once at module level to avoid re-creation */
function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      id: i,
      startX: Math.random() * 100,
      size: 2 + Math.random() * 2,
      opacity: 0.15 + Math.random() * 0.15,
      duration: 6000 + Math.random() * 6000,
      delay: Math.random() * 4000,
    });
  }
  return particles;
}

const PARTICLES = generateParticles();

interface DustMoteProps {
  particle: Particle;
}

const DustMote: React.FC<DustMoteProps> = ({ particle }) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    // Drift upward and slightly horizontal in a loop
    translateY.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(-400, {
          duration: particle.duration,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
    translateX.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming((Math.random() - 0.5) * 60, {
          duration: particle.duration,
          easing: Easing.linear,
        }),
        -1,
        true,
      ),
    );
  }, [translateY, translateX, particle.delay, particle.duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  return (
    <Animated.View
      className="absolute bg-white"
      style={[
        animatedStyle,
        {
          left: `${particle.startX}%`,
          bottom: -10,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          opacity: particle.opacity,
        },
      ]}
    />
  );
};

/**
 * Floating dust motes animation overlay.
 * Small white particles drift upward with staggered timing.
 */
const DustMotes: React.FC = () => {
  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
      {PARTICLES.map(p => (
        <DustMote key={p.id} particle={p} />
      ))}
    </View>
  );
};

export default DustMotes;
