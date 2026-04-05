import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OB_COLORS, OB_TYPOGRAPHY } from '../../constants/onboarding';
import { FONTS, CDN_BASE } from '../../core/constants/theme';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import ResolvedSubjectImage from '../../components/ui/ResolvedSubjectImage';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { track } from '../../services/analytics';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB08_DemoStory'>;

// Map monument names to CDN images as best-effort
const MONUMENT_IMAGES: Record<string, string> = {
  'Konark Sun Temple': `${CDN_BASE}monuments/Konarka_Temple-2.jpg`,
  'Rock-Hewn Churches of Lalibela': `${CDN_BASE}monuments/mesopotamia.jpg`,
  'Longmen Grottoes': `${CDN_BASE}monuments/china.jpg`,
  'Notre-Dame de Paris': `${CDN_BASE}monuments/victoria.jpg`,
  'Chichén Itzá': `${CDN_BASE}monuments/mesopotamia.jpg`,
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

const OB08_DemoStory: React.FC<Props> = ({ navigation }) => {
  const { firstName, demoStory, demoMonument, regions } = useOnboardingStore();
  const insets = useSafeAreaInsets();
  const [isStreaming, setIsStreaming] = useState(true);
  const [showEndCard, setShowEndCard] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [waitMessageIndex, setWaitMessageIndex] = useState(0);
  const [waitStepIndex, setWaitStepIndex] = useState(0);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const triggerCompletion = (monument: string) => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    setIsStreaming(false);
    if (monument) {
      track('onboarding_story_generated', { monument });
    }
    doneTimerRef.current = setTimeout(() => {
      setShowEndCard(true);
    }, 1200);
  };

  // Detect when story is complete — demoMonument is set by onDone (Gemini) or onError (fallback)
  useEffect(() => {
    if (demoMonument && demoStory.length > 0 && !completedRef.current) {
      triggerCompletion(demoMonument);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMonument, demoStory.length]);

  // Hard failsafe: if neither story nor monument arrive within 20s, force show CTA
  useEffect(() => {
    failsafeTimerRef.current = setTimeout(() => {
      if (!completedRef.current) {
        console.log('[OB08] Failsafe triggered — forcing end card');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Blinking cursor
  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      return;
    }
    const interval = setInterval(() => {
      setCursorVisible(v => !v);
    }, 500);
    return () => clearInterval(interval);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming || demoStory.length > 0) {
      return;
    }

    const messageTimer = setInterval(() => {
      setWaitMessageIndex(prev => (prev + 1) % STORY_WAIT_MESSAGES.length);
    }, 2400);

    const stepTimer = setInterval(() => {
      setWaitStepIndex(prev => (prev + 1) % STORY_WAIT_STEPS.length);
    }, 1800);

    return () => {
      clearInterval(messageTimer);
      clearInterval(stepTimer);
    };
  }, [demoStory.length, isStreaming]);

  const cardOpacity = useSharedValue(0);
  useEffect(() => {
    if (showEndCard) {
      cardOpacity.value = withTiming(1, { duration: 500 });
    }
  }, [showEndCard, cardOpacity]);
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));

  const fallbackMonumentImage = demoMonument
    ? MONUMENT_IMAGES[demoMonument]
    : undefined;
  const imageSubject =
    demoMonument ||
    (regions.length > 0
      ? `${regions[0]} heritage monument`
      : 'Historic monument and ancestry');

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
        {/* TODO(video): Replace this still header with a subtle monument cinematic loop tied to the generated story. */}
        <ResolvedSubjectImage
          subject={imageSubject}
          context={`onboarding demo story monument ${
            demoMonument || 'generated'
          }`}
          fallbackUri={fallbackMonumentImage}
          style={StyleSheet.absoluteFill}
          imageStyle={styles.imageFill}
          loadingLabel="Resolving monument visual..."
          showSkeletonWhileLoading
        />
        <LinearGradient
          colors={['transparent', 'rgba(13,13,13,0.9)']}
          style={styles.imageGradient}
        >
          {demoMonument ? (
            <View style={styles.monumentLabel}>
              <Text style={styles.monumentName}>{demoMonument}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>

      {/* Story content */}
      <View style={styles.storySection}>
        <Text style={OB_TYPOGRAPHY.tiny}>YOUR ANCESTOR</Text>

        <ScrollView
          style={styles.storyScroll}
          contentContainerStyle={styles.storyScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {demoStory.length === 0 ? (
            <View style={styles.loadingArea}>
              <AnimatedLogo size={72} motion="orbit" variant="white" />
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
                <View style={[styles.shimmerLine, { width: '85%' }]} />
                <View style={[styles.shimmerLine, { width: '70%' }]} />
              </View>
            </View>
          ) : (
            <Text style={styles.storyText}>
              {demoStory}
              {isStreaming && cursorVisible ? '|' : ''}
            </Text>
          )}
        </ScrollView>
      </View>

      {/* End card + CTA */}
      {showEndCard && (
        <Animated.View
          style={[
            styles.endCard,
            { paddingBottom: insets.bottom + 24 },
            cardStyle,
          ]}
        >
          <Text style={styles.endCardText}>
            {firstName}, this ancestor shares your lineage.
          </Text>
          <OBPrimaryButton
            label="This is real. Find mine. →"
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
    height: '38%',
    backgroundColor: '#141414',
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  monumentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monumentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  storySection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  storyScroll: {
    flex: 1,
    marginTop: 8,
  },
  storyScrollContent: {
    paddingBottom: 100,
  },
  storyText: {
    fontSize: 15,
    lineHeight: 26,
    color: '#FFFFFF',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  loadingArea: {
    marginTop: 8,
    gap: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  loadingStepText: {
    color: '#F5E9D8',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FONTS.medium,
  },
  endCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: OB_COLORS.bg,
    paddingTop: 16,
  },
  endCardText: {
    fontStyle: 'italic',
    color: '#8C93A0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    marginHorizontal: 24,
    fontFamily: FONTS.italic,
  },
  disclaimer: {
    fontSize: 11,
    color: '#8C93A0',
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 24,
    fontFamily: FONTS.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default OB08_DemoStory;
