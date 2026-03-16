import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
  ViewStyle,
  Image,
} from 'react-native';

type AuthVariant = 'google' | 'apple' | 'email';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  variant: AuthVariant;
  style?: ViewStyle;
}

const GoogleIcon = require('../../assets/images/Google.webp');

/**
 * Auth button for the Signup screen.
 * Three variants: google (white bg), apple (black bg), email (ghost).
 */
const AuthButton: React.FC<AuthButtonProps> = ({
  title,
  onPress,
  variant,
  style,
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

  // Email: amber ripple on press. Google/Apple: simple scale only.
  const animatedBg =
    variant === 'email'
      ? bgAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(212,134,10,0)', 'rgba(212,134,10,0.2)'],
        })
      : variant === 'google'
      ? '#FFFFFF'
      : '#000000';

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
          variant === 'google' && styles.googleButton,
          variant === 'apple' && styles.appleButton,
          variant === 'email' && styles.emailButton,
          style,
          { transform: [{ scale: scaleAnim }], backgroundColor: animatedBg },
        ]}
      >
        {variant === 'google' && (
          <Image
            source={GoogleIcon}
            style={styles.iconImage}
            resizeMode="contain"
          />
        )}
        {variant === 'apple' && (
          <Text style={styles.appleIconText}>{'\uF8FF'}</Text>
        )}
        {variant === 'email' && (
          <View style={styles.emailIconContainer}>
            <Text style={styles.emailIconText}>@</Text>
          </View>
        )}
        <Text style={[styles.text, variant === 'google' && styles.googleText]}>
          {title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 40,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  emailButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  iconImage: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  appleIconText: {
    fontSize: 20,
    color: '#FFFFFF',
    marginRight: 12,
  },
  emailIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emailIconText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  text: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
  googleText: {
    color: '#1A1612',
  },
});

export default AuthButton;
