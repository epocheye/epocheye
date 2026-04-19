import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import {GOLD, ACCENT} from '../../constants/onboarding';

interface Props {
  size?: number;
  children?: React.ReactNode;
}

/**
 * AR viewfinder motif — concentric gold rings, 4 corner L-brackets, a
 * vertical scan line sweeping through, and a pulsing center dot.
 * Children render centered on top so a logo can sit inside the frame.
 */
const ARViewfinder: React.FC<Props> = ({size = 220, children}) => {
  const ringOpacity = useSharedValue(0.3);
  const scanY = useSharedValue(0);
  const centerPulse = useSharedValue(1);

  useEffect(() => {
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, {duration: 1800, easing: Easing.inOut(Easing.quad)}),
        withTiming(0.3, {duration: 1800, easing: Easing.inOut(Easing.quad)}),
      ),
      -1,
      false,
    );
    scanY.value = withRepeat(
      withTiming(1, {duration: 2400, easing: Easing.inOut(Easing.quad)}),
      -1,
      true,
    );
    centerPulse.value = withRepeat(
      withSequence(
        withTiming(1.35, {duration: 900, easing: Easing.inOut(Easing.quad)}),
        withTiming(1, {duration: 900, easing: Easing.inOut(Easing.quad)}),
      ),
      -1,
      false,
    );
  }, [ringOpacity, scanY, centerPulse]);

  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{translateY: (scanY.value - 0.5) * (size * 0.7)}],
    opacity: 0.65,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{scale: centerPulse.value}],
    opacity: 2 - centerPulse.value,
  }));

  const bracketSize = size * 0.18;
  const inset = size * 0.08;

  return (
    <View style={[styles.frame, {width: size, height: size}]}>
      {/* Outer ring */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: GOLD.border,
          },
          outerRingStyle,
        ]}
      />
      {/* Inner ring */}
      <View
        style={[
          styles.ring,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: (size * 0.72) / 2,
            borderColor: 'rgba(201,168,76,0.18)',
            position: 'absolute',
          },
        ]}
      />
      {/* 4 L-brackets */}
      {([
        {top: inset, left: inset, borderTopWidth: 2, borderLeftWidth: 2},
        {top: inset, right: inset, borderTopWidth: 2, borderRightWidth: 2},
        {bottom: inset, left: inset, borderBottomWidth: 2, borderLeftWidth: 2},
        {bottom: inset, right: inset, borderBottomWidth: 2, borderRightWidth: 2},
      ] as const).map((pos, i) => (
        <View
          key={i}
          style={[
            styles.bracket,
            {
              width: bracketSize,
              height: bracketSize,
              borderColor: GOLD.primary,
              ...pos,
            },
          ]}
        />
      ))}
      {/* Vertical scan line */}
      <Animated.View
        style={[
          styles.scan,
          {
            width: size * 0.55,
            backgroundColor: ACCENT.indigo,
          },
          scanStyle,
        ]}
      />
      {/* Center pulse */}
      <Animated.View
        style={[
          styles.pulse,
          {backgroundColor: GOLD.primary},
          pulseStyle,
        ]}
      />
      {/* Children slot (logo) */}
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  bracket: {
    position: 'absolute',
    borderRadius: 2,
  },
  scan: {
    position: 'absolute',
    height: 1.5,
    borderRadius: 1,
  },
  pulse: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ARViewfinder;
