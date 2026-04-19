import React, {useEffect} from 'react';
import {View, Image, StyleSheet, StatusBar, Platform} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {BlurView} from '@react-native-community/blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CDN_BASE} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import DustMotes from '../../components/onboarding/DustMotes';
import {BG, GOLD, TEXT, TYPE, BORDER, RADIUS, SPACING} from '../../constants/onboarding';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB01_Welcome'>;

const MONUMENT_BG = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

const OB01_Welcome: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();

  const bgScale = useSharedValue(1.08);
  const eyebrowO = useSharedValue(0);
  const line1 = useSharedValue(24);
  const line1O = useSharedValue(0);
  const accentO = useSharedValue(0);
  const accentY = useSharedValue(18);
  const subO = useSharedValue(0);
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(22);

  useEffect(() => {
    track('onboarding_started');

    bgScale.value = withTiming(1.0, {
      duration: 4000,
      easing: Easing.out(Easing.quad),
    });

    eyebrowO.value = withDelay(700, withTiming(1, {duration: 600}));
    line1.value = withDelay(900, withSpring(0, {damping: 22, stiffness: 120}));
    line1O.value = withDelay(900, withTiming(1, {duration: 500}));
    accentY.value = withDelay(1200, withSpring(0, {damping: 20, stiffness: 110}));
    accentO.value = withDelay(1200, withTiming(1, {duration: 600}));
    subO.value = withDelay(1600, withTiming(1, {duration: 500}));
    ctaO.value = withDelay(2000, withTiming(1, {duration: 500}));
    ctaY.value = withDelay(2000, withSpring(0, {damping: 18, stiffness: 140}));
  }, [bgScale, eyebrowO, line1, line1O, accentO, accentY, subO, ctaO, ctaY]);

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{scale: bgScale.value}],
  }));
  const sEyebrow = useAnimatedStyle(() => ({opacity: eyebrowO.value}));
  const sLine1 = useAnimatedStyle(() => ({
    opacity: line1O.value,
    transform: [{translateY: line1.value}],
  }));
  const sAccent = useAnimatedStyle(() => ({
    opacity: accentO.value,
    transform: [{translateY: accentY.value}],
  }));
  const sSub = useAnimatedStyle(() => ({opacity: subO.value}));
  const sCta = useAnimatedStyle(() => ({
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

      {/* Ken Burns background */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Image
          source={{uri: MONUMENT_BG}}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      </Animated.View>

      <LinearGradient
        colors={['transparent', 'rgba(7,6,12,0.45)', 'rgba(7,6,12,0.92)']}
        locations={[0, 0.45, 0.85]}
        style={StyleSheet.absoluteFillObject}
      />

      <DustMotes />

      {/* Bottom glass sheet */}
      <View style={[styles.sheetWrap, {paddingBottom: insets.bottom + 28}]}>
        <View style={styles.sheet}>
          {Platform.OS === 'ios' ? (
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="dark"
              blurAmount={20}
              reducedTransparencyFallbackColor="rgba(12,9,6,0.9)"
            />
          ) : null}

          <View style={styles.sheetContent}>
            <Animated.Text style={[styles.eyebrow, sEyebrow]}>
              HERITAGE · AR
            </Animated.Text>

            <Animated.Text style={[styles.headline, sLine1]}>
              Every monument{'\n'}has a million stories.
            </Animated.Text>

            <Animated.Text style={[styles.accent, sAccent]}>
              One of them is yours.
            </Animated.Text>

            <Animated.Text style={[styles.sub, sSub]}>
              Seven steps to meet the ancestor who built your home.
            </Animated.Text>

            <Animated.View style={[styles.ctaWrap, sCta]}>
              <OBPrimaryButton
                label="Begin  →"
                onPress={() =>
                  navigation.navigate(ROUTES.ONBOARDING.OB02_MOTIVATION)
                }
              />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG.deep,
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
  },
  sheet: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BORDER.subtle,
    overflow: 'hidden',
    backgroundColor:
      Platform.OS === 'ios' ? 'rgba(12,9,6,0.35)' : 'rgba(12,9,6,0.92)',
  },
  sheetContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xl,
  },
  eyebrow: {
    ...TYPE.uiTiny,
    color: GOLD.text,
    letterSpacing: 2.4,
  },
  headline: {
    ...TYPE.displayLarge,
    fontSize: 34,
    lineHeight: 42,
    marginTop: SPACING.md,
  },
  accent: {
    ...TYPE.displayItalic,
    color: GOLD.text,
    fontSize: 20,
    lineHeight: 28,
    marginTop: SPACING.md,
  },
  sub: {
    ...TYPE.uiSmall,
    color: TEXT.secondary,
    marginTop: SPACING.xl,
  },
  ctaWrap: {
    marginTop: SPACING.xxl,
    marginHorizontal: -SPACING.xxl,
  },
});

export default OB01_Welcome;
