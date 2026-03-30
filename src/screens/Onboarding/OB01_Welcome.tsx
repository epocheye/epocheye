import React, {useEffect} from 'react';
import {View, Text, StyleSheet, StatusBar, ImageBackground} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {OB_COLORS} from '../../constants/onboarding';
import {FONTS, CDN_BASE} from '../../core/constants/theme';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB01_Welcome'>;

const MONUMENT_BG = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

const OB01_Welcome: React.FC<Props> = ({navigation}) => {
  const line1 = useSharedValue(0);
  const line2 = useSharedValue(0);
  const line3 = useSharedValue(0);
  const subLine = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    track('onboarding_started');

    line1.value = withTiming(1, {duration: 500});
    line2.value = withDelay(400, withTiming(1, {duration: 500}));
    line3.value = withDelay(900, withTiming(1, {duration: 500}));
    subLine.value = withDelay(1400, withTiming(1, {duration: 400}));
    ctaOpacity.value = withDelay(1600, withTiming(1, {duration: 400}));
  }, [line1, line2, line3, subLine, ctaOpacity]);

  const s1 = useAnimatedStyle(() => ({opacity: line1.value}));
  const s2 = useAnimatedStyle(() => ({opacity: line2.value}));
  const s3 = useAnimatedStyle(() => ({opacity: line3.value}));
  const s4 = useAnimatedStyle(() => ({opacity: subLine.value}));
  const s5 = useAnimatedStyle(() => ({opacity: ctaOpacity.value}));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <ImageBackground
        source={{uri: MONUMENT_BG}}
        style={styles.bg}
        resizeMode="cover">
        <View style={styles.overlay} />

        <View style={styles.bottomContent}>
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
            10 steps before we find your ancestor.
          </Animated.Text>

          <Animated.View style={[styles.ctaWrap, s5]}>
            <OBPrimaryButton
              label="Begin →"
              onPress={() => navigation.navigate('OB02_Motivation')}
            />
          </Animated.View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  bg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  heroLine: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
  },
  accentLine: {
    fontSize: 18,
    fontWeight: '500',
    color: '#E8A020',
    fontFamily: FONTS.medium,
    marginTop: 8,
  },
  subLine: {
    fontSize: 13,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
    marginTop: 16,
  },
  ctaWrap: {
    marginTop: 24,
  },
});

export default OB01_Welcome;
