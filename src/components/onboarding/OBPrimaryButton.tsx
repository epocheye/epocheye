import React from 'react';
import {Text, Pressable, StyleSheet, View} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {GOLD, RADIUS, TYPE} from '../../constants/onboarding';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const OBPrimaryButton: React.FC<Props> = ({
  label,
  onPress,
  disabled = false,
  icon,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: disabled ? 0.6 : 1,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, {duration: 80});
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {damping: 15, stiffness: 320});
  };

  const handlePress = () => {
    if (disabled) return;
    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {}
    onPress();
  };

  return (
    <AnimatedPressable
      style={[
        styles.wrapper,
        !disabled && styles.glow,
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}>
      {disabled ? (
        <View style={styles.disabledBg}>
          <Text style={[styles.label, styles.disabledLabel]}>{label}</Text>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
        </View>
      ) : (
        <LinearGradient
          colors={['#D4B044', '#9A7828']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gradient}>
          <Text style={styles.label}>{label}</Text>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
        </LinearGradient>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 24,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  glow: {
    shadowColor: GOLD.primary,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
  gradient: {
    height: 56,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  disabledBg: {
    height: 56,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1C17',
    paddingHorizontal: 24,
  },
  label: {
    ...TYPE.button,
    color: '#FFFFFF',
  },
  disabledLabel: {
    color: 'rgba(255,255,255,0.25)',
  },
  icon: {
    marginLeft: 8,
  },
});

export default OBPrimaryButton;
