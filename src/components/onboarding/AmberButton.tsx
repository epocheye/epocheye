import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface AmberButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

/**
 * Primary filled amber CTA button with press animation.
 */
const AmberButton: React.FC<AmberButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View
        className="h-14 items-center justify-center rounded-full bg-[#D4860A]"
        style={[
          style,
          disabled && { opacity: 0.5 },
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        <Text
          className="font-['MontserratAlternates-SemiBold'] text-lg tracking-[0.3px] text-[#F5E9D8]"
          style={textStyle}
        >
          {title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default AmberButton;
