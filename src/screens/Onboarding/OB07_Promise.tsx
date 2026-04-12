import React, {useEffect, useRef, useState} from 'react';
import {View, StyleSheet, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FONTS} from '../../core/constants/theme';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import DustMotes from '../../components/onboarding/DustMotes';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {streamAncestorStory} from '../../services/ancestorStoryService';
import {getFallbackStory} from '../../services/fallbackStories';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB07_Promise'>;

const OB07_Promise: React.FC<Props> = ({navigation}) => {
  const {firstName, regions, motivation, visitFrequency, goal} =
    useOnboardingStore();
  const appendStoryChunk = useOnboardingStore(s => s.appendStoryChunk);
  const setDemoMonument = useOnboardingStore(s => s.setDemoMonument);
  const insets = useSafeAreaInsets();
  const [showCta, setShowCta] = useState(false);
  const apiStarted = useRef(false);

  // Staggered text: translateY + opacity
  const nameO = useSharedValue(0);
  const nameY = useSharedValue(16);
  const line1O = useSharedValue(0);
  const line1Y = useSharedValue(12);
  const line2O = useSharedValue(0);
  const line2Y = useSharedValue(12);
  const accentO = useSharedValue(0);
  const accentY = useSharedValue(12);
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(24);

  useEffect(() => {
    // Name
    nameO.value = withTiming(1, {duration: 500});
    nameY.value = withSpring(0, {damping: 18, stiffness: 120});

    // Line 1
    line1O.value = withDelay(500, withTiming(1, {duration: 400}));
    line1Y.value = withDelay(500, withSpring(0, {damping: 18, stiffness: 120}));

    // Line 2
    line2O.value = withDelay(900, withTiming(1, {duration: 400}));
    line2Y.value = withDelay(900, withSpring(0, {damping: 18, stiffness: 120}));

    // Accent
    accentO.value = withDelay(1400, withTiming(1, {duration: 400}));
    accentY.value = withDelay(1400, withSpring(0, {damping: 18, stiffness: 120}));

    // CTA
    const timer = setTimeout(() => {
      setShowCta(true);
      ctaO.value = withTiming(1, {duration: 400});
      ctaY.value = withSpring(0, {damping: 14, stiffness: 140});
    }, 2500);

    return () => clearTimeout(timer);
  }, [nameO, nameY, line1O, line1Y, line2O, line2Y, accentO, accentY, ctaO, ctaY]);

  // Fire API call on mount
  useEffect(() => {
    if (apiStarted.current) {
      return;
    }
    apiStarted.current = true;

    // Reset story state before starting
    useOnboardingStore.setState({demoStory: '', demoMonument: ''});

    const abort = streamAncestorStory({
      firstName,
      regions,
      motivation: motivation ?? '',
      visitFrequency: visitFrequency ?? '',
      goal: goal ?? 'weekly',
      onChunk: text => appendStoryChunk(text),
      onDone: monument => setDemoMonument(monument),
      onError: () => {
        const fallback = getFallbackStory(
          regions[0] ?? 'South Asia',
          firstName,
        );
        useOnboardingStore.setState({
          demoStory: fallback.story,
          demoMonument: fallback.monument,
        });
      },
    });

    return () => abort();
  }, [
    firstName,
    regions,
    motivation,
    visitFrequency,
    goal,
    appendStoryChunk,
    setDemoMonument,
  ]);

  const sName = useAnimatedStyle(() => ({
    opacity: nameO.value,
    transform: [{translateY: nameY.value}],
  }));
  const sLine1 = useAnimatedStyle(() => ({
    opacity: line1O.value,
    transform: [{translateY: line1Y.value}],
  }));
  const sLine2 = useAnimatedStyle(() => ({
    opacity: line2O.value,
    transform: [{translateY: line2Y.value}],
  }));
  const sAccent = useAnimatedStyle(() => ({
    opacity: accentO.value,
    transform: [{translateY: accentY.value}],
  }));
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
      <OBProgressBar current={6} total={10} />
      <DustMotes />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <View style={styles.centerArea}>
          <View style={styles.logoWrap}>
            <AnimatedLogo size={116} motion="orbit" variant="white" />
          </View>

          <Animated.Text style={[styles.nameText, sName]}>
            {firstName || 'Explorer'}.
          </Animated.Text>
          <Animated.Text style={[styles.greyText, sLine1]}>
            Somewhere in history, someone from
          </Animated.Text>
          <Animated.Text style={[styles.greyText, sLine2]}>
            your lineage stood where you're about to stand.
          </Animated.Text>
          <Animated.Text style={[styles.accentText, sAccent]}>
            Let us introduce you.
          </Animated.Text>
        </View>

        {showCta && (
          <Animated.View style={sCta}>
            <OBPrimaryButton
              label="Meet them  \u2192"
              onPress={() => navigation.navigate('OB08_DemoStory')}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0908',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    width: 132,
    height: 132,
    marginBottom: 32,
    borderRadius: 66,
  },
  nameText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
    marginBottom: 14,
  },
  greyText: {
    fontSize: 15,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 23,
  },
  accentText: {
    fontSize: 17,
    color: '#E8A020',
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginTop: 14,
    textAlign: 'center',
  },
});

export default OB07_Promise;
