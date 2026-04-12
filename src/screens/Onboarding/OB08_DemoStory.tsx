import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {OB_COLORS, OB_TYPOGRAPHY} from '../../constants/onboarding';
import {FONTS, CDN_BASE} from '../../core/constants/theme';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {track} from '../../services/analytics';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB08_DemoStory'>;

// Map monument names to CDN images
const MONUMENT_IMAGES: Record<string, string> = {
  'Konark Sun Temple': `${CDN_BASE}monuments/Konarka_Temple-2.jpg`,
  'Rock-Hewn Churches of Lalibela': `${CDN_BASE}monuments/mesopotamia.jpg`,
  'Longmen Grottoes': `${CDN_BASE}monuments/china.jpg`,
  'Notre-Dame de Paris': `${CDN_BASE}monuments/victoria.jpg`,
  'Chich\u00e9n Itz\u00e1': `${CDN_BASE}monuments/mesopotamia.jpg`,
  Persepolis: `${CDN_BASE}monuments/persia.jpg`,
  'Angkor Wat': `${CDN_BASE}monuments/tamil.jpg`,
};

const STORY_WAIT_MESSAGES = [
  'Dusting off centuries of whispers...',
  'Matching your lineage with living monuments...',
  'Cross-checking oral legends with verified records...',
  'Searching for the ancestor most likely to walk beside you...',
  'Translating old scripts into your modern story...',
  'Composing a first chapter you can visit in real life...',
];

const STORY_WAIT_STEPS = [
  'Reading temple inscriptions',
  'Comparing migration clues',
  'Linking regions to monuments',
  'Finalizing your timeline',
];

const OB08_DemoStory: React.FC<Props> = ({navigation}) => {
  const {firstName, demoStory, demoMonument} = useOnboardingStore();
  const insets = useSafeAreaInsets();
  const [isStreaming, setIsStreaming] = useState(true);
  const [showEndCard, setShowEndCard] = useState(false);
  const [waitMessageIndex, setWaitMessageIndex] = useState(0);
  const [waitStepIndex, setWaitStepIndex] = useState(0);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const cursorOpacity = useSharedValue(1);

  const triggerCompletion = (monument: string) => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    setIsStreaming(false);
    if (monument) {
      track('onboarding_story_generated', {monument});
    }
    doneTimerRef.current = setTimeout(() => {
      setShowEndCard(true);
    }, 1200);
  };

  // Detect when story is complete
  useEffect(() => {
    if (demoMonument && demoStory.length > 0 && !completedRef.current) {
      triggerCompletion(demoMonument);
    }
  }, [demoMonument, demoStory.length]);

  // 20s failsafe
  useEffect(() => {
    failsafeTimerRef.current = setTimeout(() => {
      if (!completedRef.current) {
        triggerCompletion('');
        setShowEndCard(true);
      }
    }, 20000);

    return () => {
      if (failsafeTimerRef.current) {
        clearTimeout(failsafeTimerRef.current);
      }
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
      }
    };
  }, []);

  // Blinking cursor
  useEffect(() => {
    if (isStreaming) {
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(0, {duration: 400, easing: Easing.inOut(Easing.quad)}),
          withTiming(1, {duration: 400, easing: Easing.inOut(Easing.quad)}),
        ),
        -1,
        false,
      );
    } else {
      cursorOpacity.value = withTiming(0, {duration: 200});
    }
  }, [isStreaming, cursorOpacity]);

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  // Loading state rotation
  useEffect(() => {
    if (!isStreaming || demoStory.length > 0) {
      return;
    }

    const loadingTimer = setInterval(() => {
      setWaitMessageIndex(prev => (prev + 1) % STORY_WAIT_MESSAGES.length);
      setWaitStepIndex(prev => (prev + 1) % STORY_WAIT_STEPS.length);
    }, 2400);

    return () => clearInterval(loadingTimer);
  }, [demoStory.length, isStreaming]);

  // End card animation
  const cardY = useSharedValue(100);
  const cardO = useSharedValue(0);
  useEffect(() => {
    if (showEndCard) {
      cardO.value = withTiming(1, {duration: 400});
      cardY.value = withSpring(0, {damping: 16, stiffness: 120});
    }
  }, [showEndCard, cardO, cardY]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardO.value,
    transform: [{translateY: cardY.value}],
  }));

  const monumentImage = demoMonument
    ? MONUMENT_IMAGES[demoMonument]
    : `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={7} total={10} />

      {/* Monument image header */}
      <View style={styles.imageHeader}>
        <Image
          source={{uri: monumentImage}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(13,13,13,0.9)']}
          style={styles.imageGradient}>
          {demoMonument ? (
            <Text style={styles.monumentName}>{demoMonument}</Text>
          ) : null}
        </LinearGradient>
      </View>

      {/* Story content */}
      <View style={styles.storySection}>
        <Text style={OB_TYPOGRAPHY.tiny}>YOUR ANCESTOR</Text>

        <ScrollView
          style={styles.storyScroll}
          contentContainerStyle={styles.storyScrollContent}
          showsVerticalScrollIndicator={false}>
          {demoStory.length === 0 ? (
            <View style={styles.loadingArea}>
              <AnimatedLogo
                size={72}
                motion="pulse"
                variant="white"
                showRing={false}
              />
              <Text style={styles.loadingHeadline}>
                {STORY_WAIT_MESSAGES[waitMessageIndex]}
              </Text>
              <Text style={styles.loadingText}>
                {firstName}, your story is being crafted with Gemini + verified
                historical context.
              </Text>

              <View style={styles.loadingStepPill}>
                <Text style={styles.loadingStepText}>
                  {STORY_WAIT_STEPS[waitStepIndex]}
                </Text>
              </View>

              <View style={styles.shimmerGroup}>
                <View style={styles.shimmerLine} />
                <View style={[styles.shimmerLine, {width: '85%'}]} />
                <View style={[styles.shimmerLine, {width: '70%'}]} />
              </View>
            </View>
          ) : (
            <Text style={styles.storyText}>
              {demoStory}
              {isStreaming ? (
                <Animated.Text style={cursorStyle}> |</Animated.Text>
              ) : null}
            </Text>
          )}
        </ScrollView>
      </View>

      {/* End card slides up from bottom */}
      {showEndCard && (
        <Animated.View
          style={[
            styles.endCard,
            {paddingBottom: insets.bottom + 24},
            cardStyle,
          ]}>
          <Text style={styles.endCardText}>
            {firstName}, this ancestor shares your lineage.
          </Text>
          <OBPrimaryButton
            label={"This is real. Find mine.  →"}
            onPress={() => navigation.navigate('OB09_Reaction')}
          />
          <Text style={styles.disclaimer}>
            Every story is generated from historian-verified records.
          </Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  imageHeader: {
    height: '36%',
    backgroundColor: '#141414',
  },
  imageGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  monumentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  storySection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  storyScroll: {
    flex: 1,
    marginTop: 8,
  },
  storyScrollContent: {
    paddingBottom: 120,
  },
  storyText: {
    fontSize: 15,
    lineHeight: 27,
    color: '#F0EBD8',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  loadingArea: {
    marginTop: 12,
    gap: 14,
    alignItems: 'center',
    paddingTop: 8,
  },
  shimmerGroup: {
    width: '100%',
    gap: 12,
  },
  shimmerLine: {
    height: 14,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    width: '100%',
  },
  loadingHeadline: {
    color: '#E8A020',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginHorizontal: 8,
    fontFamily: FONTS.semiBold,
  },
  loadingText: {
    color: '#8C93A0',
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 8,
    lineHeight: 20,
    fontFamily: FONTS.regular,
  },
  loadingStepPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 32, 0.4)',
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  loadingStepText: {
    color: '#F5E9D8',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: FONTS.medium,
  },
  endCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: OB_COLORS.bg,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232, 160, 32, 0.15)',
  },
  endCardText: {
    fontStyle: 'italic',
    color: '#B8AF9E',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    marginHorizontal: 24,
    fontFamily: FONTS.italic,
  },
  disclaimer: {
    fontSize: 11,
    color: '#5A5248',
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 24,
    fontFamily: FONTS.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default OB08_DemoStory;
