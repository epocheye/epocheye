import React, { useEffect, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SwirlConfig {
  top: number;
  left: number;
  width: number;
  height: number;
  rotation: number;
  travelX: number;
  travelY: number;
  duration: number;
  opacity: number;
}

const SWIRLS: SwirlConfig[] = [
  {
    top: -100,
    left: -110,
    width: 420,
    height: 300,
    rotation: -14,
    travelX: 24,
    travelY: 18,
    duration: 16000,
    opacity: 0.38,
  },
  {
    top: -50,
    left: 170,
    width: 360,
    height: 290,
    rotation: 22,
    travelX: -26,
    travelY: 20,
    duration: 17500,
    opacity: 0.28,
  },
  {
    top: 230,
    left: -90,
    width: 430,
    height: 320,
    rotation: 12,
    travelX: 20,
    travelY: -16,
    duration: 19500,
    opacity: 0.24,
  },
  {
    top: 280,
    left: 150,
    width: 380,
    height: 300,
    rotation: -18,
    travelX: -22,
    travelY: -18,
    duration: 18200,
    opacity: 0.2,
  },
  {
    top: 560,
    left: -40,
    width: 470,
    height: 250,
    rotation: 4,
    travelX: 14,
    travelY: -12,
    duration: 22000,
    opacity: 0.18,
  },
];

const AnimatedSwirl: React.FC<{ config: SwirlConfig }> = ({ config }) => {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);

  useEffect(() => {
    offsetX.value = withRepeat(
      withTiming(config.travelX, {
        duration: config.duration,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );

    offsetY.value = withRepeat(
      withTiming(config.travelY, {
        duration: Math.round(config.duration * 0.85),
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [config, offsetX, offsetY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { rotate: `${config.rotation}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.swirl,
        animatedStyle,
        {
          top: config.top,
          left: config.left,
          width: config.width,
          height: config.height,
          opacity: config.opacity,
        },
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(244,244,244,0.48)',
          'rgba(170,170,170,0.12)',
          'rgba(240,240,240,0.22)',
          'rgba(22,22,22,0.04)',
        ]}
        locations={[0, 0.34, 0.68, 1]}
        start={{ x: 0.08, y: 0.2 }}
        end={{ x: 0.9, y: 0.85 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

/**
 * Reusable liquid monochrome background for authentication surfaces.
 */
const AuthLiquidBackground: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#000000', '#030303', '#000000']}
        locations={[0, 0.52, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {SWIRLS.map((config, index) => (
        <AnimatedSwirl
          key={`${config.top}-${config.left}-${index}`}
          config={config}
        />
      ))}

      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.62)', 'rgba(0,0,0,0.74)']}
        locations={[0, 0.58, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  swirl: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
});

export default AuthLiquidBackground;
