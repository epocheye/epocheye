import React, {useEffect} from 'react';
import {Image, StatusBar, StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {ROUTES} from '../../core/constants/routes';
import {COLORS, FONTS} from '../../core/constants/theme';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB00_Splash'>;

const HOLD_DURATION_MS = 1600;

const OB00_Splash: React.FC<Props> = ({navigation}) => {
  const logoOpacity = useSharedValue(0);
  const wordmarkOpacity = useSharedValue(0);

  useEffect(() => {
    const goNext = () => navigation.replace(ROUTES.ONBOARDING.OB01_WELCOME);

    logoOpacity.value = withTiming(1, {duration: 700});
    wordmarkOpacity.value = withDelay(500, withTiming(1, {duration: 600}));

    const timer = setTimeout(() => runOnJS(goNext)(), HOLD_DURATION_MS + 900);
    return () => clearTimeout(timer);
  }, [navigation, logoOpacity, wordmarkOpacity]);

  const logoStyle = useAnimatedStyle(() => ({opacity: logoOpacity.value}));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgWarm} translucent />

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Image
          source={require('../../assets/images/logo-white.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.wordmarkWrap, wordmarkStyle]}>
        <Text style={styles.wordmark}>epocheye</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: 110,
    height: 108,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  wordmarkWrap: {
    position: 'absolute',
    bottom: 88,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: FONTS.medium,
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default OB00_Splash;
