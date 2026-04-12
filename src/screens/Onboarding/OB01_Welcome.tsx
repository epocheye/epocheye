import React, {useEffect} from 'react';
import {View, Image, StyleSheet, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONTS, CDN_BASE} from '../../core/constants/theme';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import DustMotes from '../../components/onboarding/DustMotes';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB01_Welcome'>;

const MONUMENT_BG = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

const OB01_Welcome: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  // Staggered text entries: translateY + opacity
  const line1Y = useSharedValue(24);
  const line1O = useSharedValue(0);
  const line2Y = useSharedValue(24);
  const line2O = useSharedValue(0);
  const accentY = useSharedValue(24);
  const accentO = useSharedValue(0);
  const subO = useSharedValue(0);
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(20);

  useEffect(() => {
    track('onboarding_started');

    // Line 1: "Every monument"
    line1Y.value = withDelay(300, withSpring(0, {damping: 20, stiffness: 120}));
    line1O.value = withDelay(300, withTiming(1, {duration: 400}));

    // Line 2: "has a million stories."
    line2Y.value = withDelay(600, withSpring(0, {damping: 20, stiffness: 120}));
    line2O.value = withDelay(600, withTiming(1, {duration: 400}));

    // Accent: "One of them is yours."
    accentY.value = withDelay(1000, withSpring(0, {damping: 20, stiffness: 120}));
    accentO.value = withDelay(1000, withTiming(1, {duration: 400}));

    // Sub line
    subO.value = withDelay(1400, withTiming(1, {duration: 400}));

    // CTA
    ctaO.value = withDelay(1600, withTiming(1, {duration: 400}));
    ctaY.value = withDelay(1600, withSpring(0, {damping: 18, stiffness: 140}));
  }, [line1Y, line1O, line2Y, line2O, accentY, accentO, subO, ctaO, ctaY]);

  const s1 = useAnimatedStyle(() => ({
    opacity: line1O.value,
    transform: [{translateY: line1Y.value}],
  }));
  const s2 = useAnimatedStyle(() => ({
    opacity: line2O.value,
    transform: [{translateY: line2Y.value}],
  }));
  const s3 = useAnimatedStyle(() => ({
    opacity: accentO.value,
    transform: [{translateY: accentY.value}],
  }));
  const s4 = useAnimatedStyle(() => ({opacity: subO.value}));
  const s5 = useAnimatedStyle(() => ({
    opacity: ctaO.value,
    transform: [{translateY: ctaY.value}],
  }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Full-bleed monument image */}
      <Image
        source={{uri: MONUMENT_BG}}
        style={styles.bgImage}
        resizeMode="cover"
      />

      {/* Dark gradient overlay */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(5,5,5,0.3)',
          'rgba(5,5,5,0.75)',
          'rgba(5,5,5,0.95)',
        ]}
        locations={[0, 0.35, 0.6, 0.85]}
        style={styles.gradient}
      />

      {/* Dust motes for atmosphere */}
      <DustMotes />

      {/* Bottom content */}
      <View style={[styles.bottomContent, {paddingBottom: insets.bottom + 24}]}>
        <Animated.Text style={[styles.heroLine, s1]}>
          Every monument
        </Animated.Text>
        <Animated.Text style={[styles.heroLine, s2]}>
          has a million stories.
        </Animated.Text>
        <Animated.Text style={[styles.accentLine, s3]}>
          One of them is yours.
        </Animated.Text>
        <Animated.Text style={[styles.subLine, s4]}>
          10 steps to find your ancestor.
        </Animated.Text>

        <Animated.View style={[styles.ctaWrap, s5]}>
          <OBPrimaryButton
            label={"Begin  →"}
            onPress={() => navigation.navigate('OB02_Motivation')}
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
  },
  heroLine: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
  },
  accentLine: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    color: '#E8A020',
    fontFamily: FONTS.medium,
    marginTop: 10,
  },
  subLine: {
    fontSize: 13,
    lineHeight: 18,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
    marginTop: 20,
  },
  ctaWrap: {
    marginTop: 24,
    marginHorizontal: -4, // offset button's own marginHorizontal
  },
});

export default OB01_Welcome;
