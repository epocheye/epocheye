import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import LogoWhite from '../../assets/images/logo-white.svg';
import LogoBlack from '../../assets/images/logo-black.svg';

type LogoVariant = 'white' | 'black';
type LogoMotion = 'pulse' | 'orbit' | 'drift';

interface AnimatedLogoProps {
  variant?: LogoVariant;
  size?: number;
  motion?: LogoMotion;
  showRing?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  variant = 'white',
  size = 80,
  motion = 'pulse',
  showRing = true,
  style,
}) => {
  const scaleProgress = useSharedValue(0);
  const rotation = useSharedValue(0);
  const yDrift = useSharedValue(0);

  useEffect(() => {
    scaleProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    rotation.value = withRepeat(
      withTiming(360, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );

    yDrift.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [rotation, scaleProgress, yDrift]);

  const logoStyle = useAnimatedStyle(() => {
    const pulseScale = interpolate(scaleProgress.value, [0, 1], [0.92, 1.08]);
    const orbitTilt = interpolate(scaleProgress.value, [0, 1], [-5, 5]);

    if (motion === 'orbit') {
      return {
        transform: [
          { scale: pulseScale },
          { rotateZ: `${rotation.value}deg` },
          { translateY: yDrift.value },
        ],
      };
    }

    if (motion === 'drift') {
      return {
        transform: [
          { scale: interpolate(scaleProgress.value, [0, 1], [0.96, 1.04]) },
          { rotateZ: `${orbitTilt}deg` },
          { translateY: yDrift.value },
        ],
      };
    }

    return {
      transform: [{ scale: pulseScale }, { rotateZ: `${orbitTilt / 2}deg` }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${-rotation.value}deg` }],
    opacity: interpolate(scaleProgress.value, [0, 1], [0.2, 0.55]),
  }));

  const ringColor =
    variant === 'white'
      ? 'rgba(245, 240, 232, 0.34)'
      : 'rgba(12, 12, 12, 0.34)';

  const LogoComponent = variant === 'black' ? LogoBlack : LogoWhite;

  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      {showRing && (
        <Animated.View
          style={[
            styles.ring,
            {
              width: size + 12,
              height: size + 12,
              borderColor: ringColor,
            },
            ringStyle,
          ]}
        />
      )}
      <Animated.View style={logoStyle}>
        <LogoComponent width={size} height={size} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
  },
});

export default AnimatedLogo;
