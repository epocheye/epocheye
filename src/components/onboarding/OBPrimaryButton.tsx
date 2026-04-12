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
import {FONTS} from '../../core/constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const OBPrimaryButton: React.FC<Props> = ({label, onPress, disabled = false}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: disabled ? 0.5 : 1,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, {duration: 80});
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {damping: 14, stiffness: 300});
  };

  const handlePress = () => {
    if (disabled) {
      return;
    }
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
      style={[styles.wrapper, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}>
      {disabled ? (
        <View style={styles.disabledBg}>
          <Text style={[styles.label, styles.disabledLabel]}>{label}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={['#EDAF2A', '#D4900C']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gradient}>
          <Text style={styles.label}>{label}</Text>
        </LinearGradient>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 24,
    borderRadius: 14,
    overflow: 'hidden',
    // Subtle glow shadow
    shadowColor: '#E8A020',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  gradient: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBg: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
    fontFamily: FONTS.bold,
  },
  disabledLabel: {
    color: '#666',
  },
});

export default OBPrimaryButton;
