import React, {useEffect} from 'react';
import {
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB01_Welcome'>;

const OB01_Welcome: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  const headlineO = useSharedValue(0);
  const headlineY = useSharedValue(18);
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(22);

  useEffect(() => {
    headlineO.value = withDelay(400, withTiming(1, {duration: 700}));
    headlineY.value = withDelay(
      400,
      withTiming(0, {duration: 700, easing: Easing.out(Easing.cubic)}),
    );
    ctaO.value = withDelay(900, withTiming(1, {duration: 500}));
    ctaY.value = withDelay(
      900,
      withTiming(0, {duration: 500, easing: Easing.out(Easing.cubic)}),
    );
  }, [headlineO, headlineY, ctaO, ctaY]);

  const sHeadline = useAnimatedStyle(() => ({
    opacity: headlineO.value,
    transform: [{translateY: headlineY.value}],
  }));
  const sCta = useAnimatedStyle(() => ({
    opacity: ctaO.value,
    transform: [{translateY: ctaY.value}],
  }));

  const onGetStarted = () => {
    navigation.navigate(ROUTES.ONBOARDING.OB02_NAME);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.heroWrap}>
        <Image
          source={require('../../assets/images/onboarding.webp')}
          style={styles.hero}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(17,17,17,0.6)', '#111111']}
          locations={[0, 0.7, 1]}
          style={styles.heroFade}
        />
      </View>

      <View style={styles.bottom}>
        <Animated.View style={[styles.headlineWrap, sHeadline]}>
          <Text style={styles.headlineIntro}>It's time to</Text>
          <Text style={styles.headlineAccent}>Experience</Text>
        </Animated.View>

        <Animated.View style={[styles.ctaWrap, sCta]}>
          <Pressable
            onPress={onGetStarted}
            style={({pressed}) => [
              styles.cta,
              pressed && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Get Started">
            <Text style={styles.ctaLabel}>Get Started</Text>
          </Pressable>
        </Animated.View>

        <Text style={[styles.footer, {marginBottom: insets.bottom + 12}]}>
          Copyright @ epocheye 2026
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  heroWrap: {
    height: '68%',
    width: '100%',
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },
  bottom: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  headlineWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headlineIntro: {
    fontFamily: FONTS.handwritten,
    fontSize: 44,
    color: '#FFFFFF',
    lineHeight: 52,
  },
  headlineAccent: {
    fontFamily: FONTS.handwritten,
    fontSize: 60,
    color: COLORS.lime,
    lineHeight: 68,
    marginTop: -6,
  },
  ctaWrap: {
    width: '100%',
    alignItems: 'center',
  },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: COLORS.skyDark,
    transform: [{scale: 0.98}],
  },
  ctaLabel: {
    fontFamily: FONTS.medium,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 18,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.4,
  },
});

export default OB01_Welcome;
