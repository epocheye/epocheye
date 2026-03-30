import React from 'react';
import {
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
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
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: disabled ? 0.6 : opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, {duration: 100});
    opacity.value = withTiming(0.9, {duration: 100});
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, {duration: 150});
    opacity.value = withTiming(1, {duration: 150});
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
      style={[
        styles.button,
        disabled ? styles.disabled : styles.enabled,
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}>
      <Text
        style={[
          styles.label,
          {color: disabled ? '#666' : '#0D0D0D'},
        ]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
  },
  enabled: {
    backgroundColor: '#E8A020',
  },
  disabled: {
    backgroundColor: '#3A3A3A',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: FONTS.bold,
      android: FONTS.bold,
    }),
  },
});

export default OBPrimaryButton;
