import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
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
 * Ghost button — white border, transparent fill, rounded 40px.
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
    outputRange: ['rgba(212,134,10,0)', 'rgba(212,134,10,0.25)'],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.button,
          style,
          { transform: [{ scale: scaleAnim }], backgroundColor },
        ]}
      >
        <Text style={[styles.text, textStyle]}>{title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 40,
    paddingVertical: 14,
    width: 180,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  text: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default GhostButton;
