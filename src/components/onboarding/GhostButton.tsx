import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface GhostButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * Ghost button — white border, transparent fill, rounded pill.
 * Warm amber ripple animation on tap.
 */
const GhostButton: React.FC<GhostButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(bgAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [scaleAnim, bgAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: false,
      }),
      Animated.timing(bgAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [scaleAnim, bgAnim]);

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(212,134,10,0)', 'rgba(212,134,10,0.2)'],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View
        className="h-14 self-center rounded-full border-[1.5px] border-[rgba(255,255,255,0.3)] px-10 items-center justify-center"
        style={[style, { transform: [{ scale: scaleAnim }], backgroundColor }]}
      >
        <Text
          className="font-['MontserratAlternates-Medium'] text-lg tracking-[0.3px] text-[#F5E9D8]"
          style={textStyle}
        >
          {title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default GhostButton;
