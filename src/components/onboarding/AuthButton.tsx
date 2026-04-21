import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  Animated,
  View,
  ViewStyle,
  Image,
} from 'react-native';
import { COLORS } from '../../core/constants/theme';

type AuthVariant = 'google' | 'apple' | 'email';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  variant: AuthVariant;
  style?: ViewStyle;
  disabled?: boolean;
}

const GoogleIcon = require('../../assets/images/Google.webp');

/**
 * Auth button for the Signup/Login screens.
 * Three variants: google (white bg), apple (black bg), email (ghost with border).
 */
const AuthButton: React.FC<AuthButtonProps> = ({
  title,
  onPress,
  variant,
  style,
  disabled = false,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const bgAnim = React.useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
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

  const animatedBg =
    variant === 'email'
      ? bgAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(212,134,10,0)', 'rgba(212,134,10,0.15)'],
        })
      : variant === 'google'
      ? COLORS.google
      : COLORS.apple;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      <Animated.View
        className={`h-14 flex-row items-center justify-center rounded-full px-5 ${
          variant === 'email' || variant === 'apple'
            ? 'border border-[rgba(255,255,255,0.24)]'
            : ''
        }`}
        style={[
          style,
          { transform: [{ scale: scaleAnim }], backgroundColor: animatedBg },
        ]}
      >
        {variant === 'google' && (
          <Image
            source={GoogleIcon}
            className="mr-3 h-5 w-5"
            resizeMode="contain"
          />
        )}
        {variant === 'apple' && (
          <Image
            source={require('../../assets/images/Apple.webp')}
            className="mr-3 h-5 w-5"
            resizeMode="contain"
          />
        )}
        {variant === 'email' && (
          <View className="mr-3 h-6 w-6 items-center justify-center">
            <Text className="font-['MontserratAlternates-Medium'] text-lg text-[#F5E9D8]">
              @
            </Text>
          </View>
        )}
        <Text
          className={`font-['MontserratAlternates-Medium'] text-lg ${
            variant === 'google' ? 'text-[#1A1612]' : 'text-[#F5E9D8]'
          }`}
        >
          {title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default AuthButton;
