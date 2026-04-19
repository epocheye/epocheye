import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {streamAncestorStory} from '../../services/ancestorStoryService';
import {getFallbackStory} from '../../services/fallbackStories';
import {track} from '../../services/analytics';
import {ROUTES} from '../../core/constants/routes';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import GlassCard from '../../components/onboarding/GlassCard';
import DustMotes from '../../components/onboarding/DustMotes';
import {
  BG,
  GOLD,
  TEXT,
  TYPE,
  SPACING,
  RADIUS,
  BORDER,
} from '../../constants/onboarding';
import {DISPLAY_FONTS} from '../../core/constants/fonts';
import {
  MONUMENT_IMAGES,
  REGION_FALLBACK_IMAGES,
  DEFAULT_MONUMENT_IMAGE,
  STORY_WAIT_MESSAGES,
  STORY_WAIT_STEPS,
} from '../../constants/onboarding/monumentImages';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB07_Promise'>;
type Phase = 'promise' | 'loading' | 'story';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const LoadingDots: React.FC = () => {
  const a = useSharedValue(0.3);
  const b = useSharedValue(0.3);
  const c = useSharedValue(0.3);

  useEffect(() => {
    const loop = (sv: SharedValue<number>, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, {duration: 450, easing: Easing.inOut(Easing.quad)}),
            withTiming(0.3, {duration: 450, easing: Easing.inOut(Easing.quad)}),
          ),
          -1,
          false,
        ),
      );
    };
    loop(a, 0);
    loop(b, 160);
    loop(c, 320);
  }, [a, b, c]);

  const sA = useAnimatedStyle(() => ({opacity: a.value}));
  const sB = useAnimatedStyle(() => ({opacity: b.value}));
  const sC = useAnimatedStyle(() => ({opacity: c.value}));

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, sA]} />
      <Animated.View style={[styles.dot, sB]} />
      <Animated.View style={[styles.dot, sC]} />
    </View>
  );
};

const ShimmerLine: React.FC<{width: string | number; delay?: number}> = ({
  width,
  delay = 0,
}) => {
  const x = useSharedValue(-200);
  useEffect(() => {
    x.value = withDelay(
      delay,
      withRepeat(
        withTiming(SCREEN_WIDTH, {duration: 1200, easing: Easing.linear}),
        -1,
        false,
      ),
    );
  }, [x, delay]);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{translateX: x.value}],
  }));
  return (
    <View style={[styles.shimmerBar, {width: width as number}]}>
      <Animated.View style={[styles.shimmerSweep, aStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(201,168,76,0.18)',
            'transparent',
          ]}
          start={{x: 0, y: 0.5}}
          end={{x: 1, y: 0.5}}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

const OB07_Promise: React.FC<Props> = ({navigation}) => {
  const {firstName, regions, motivation, visitFrequency, goal, demoStory, demoMonument} =
    useOnboardingStore();
  const appendStoryChunk = useOnboardingStore(s => s.appendStoryChunk);
  const setDemoMonument = useOnboardingStore(s => s.setDemoMonument);
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>('promise');
  const [waitMsgIdx, setWaitMsgIdx] = useState(0);
  const [waitStepIdx, setWaitStepIdx] = useState(0);
  const [showEndCard, setShowEndCard] = useState(false);
  const apiStarted = useRef(false);
  const completedRef = useRef(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heroImage = useMemo(() => {
    if (demoMonument && MONUMENT_IMAGES[demoMonument]) {
      return MONUMENT_IMAGES[demoMonument];
    }
    const fallback = regions[0] ? REGION_FALLBACK_IMAGES[regions[0]] : undefined;
    return fallback ?? DEFAULT_MONUMENT_IMAGE;
  }, [demoMonument, regions]);

  // Ken Burns on the promise image
  const bgScale = useSharedValue(1.06);
  useEffect(() => {
    bgScale.value = withTiming(1.0, {
      duration: 5000,
      easing: Easing.out(Easing.quad),
    });
  }, [bgScale]);
  const bgStyle = useAnimatedStyle(() => ({
    transform: [{scale: bgScale.value}],
  }));

  // ── Fire SSE on mount ──────────────────────────────
  useEffect(() => {
    if (apiStarted.current) return;
    apiStarted.current = true;

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
        const fb = getFallbackStory(regions[0] ?? 'South Asia', firstName);
        useOnboardingStore.setState({
          demoStory: fb.story,
          demoMonument: fb.monument,
        });
      },
    });

    return () => abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Detect completion (parity with the old OB08) ───
  const triggerCompletion = useCallback((monument: string) => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (monument) {
      track('onboarding_story_generated', {monument});
    }
    doneTimer.current = setTimeout(() => {
      setShowEndCard(true);
    }, 1200);
  }, []);

  useEffect(() => {
    if (demoMonument && demoStory.length > 0 && !completedRef.current) {
      triggerCompletion(demoMonument);
    }
  }, [demoMonument, demoStory.length, triggerCompletion]);

  // 20s failsafe
  useEffect(() => {
    failsafeTimer.current = setTimeout(() => {
      if (!completedRef.current) {
        triggerCompletion('');
        setShowEndCard(true);
      }
    }, 20000);
    return () => {
      if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, [triggerCompletion]);

  // Auto-advance promise → loading never happens on its own; user taps CTA.
  // Loading → story once first chunk arrives.
  useEffect(() => {
    if (phase === 'loading' && demoStory.length > 0) {
      setPhase('story');
    }
  }, [phase, demoStory.length]);

  // Rotating wait messages while in loading
  useEffect(() => {
    if (phase !== 'loading') return;
    const iv = setInterval(() => {
      setWaitMsgIdx(i => (i + 1) % STORY_WAIT_MESSAGES.length);
      setWaitStepIdx(i => (i + 1) % STORY_WAIT_STEPS.length);
    }, 2400);
    return () => clearInterval(iv);
  }, [phase]);

  // End-card slide up
  const endCardY = useSharedValue(120);
  const endCardO = useSharedValue(0);
  useEffect(() => {
    if (showEndCard) {
      endCardO.value = withTiming(1, {duration: 500});
      endCardY.value = withSpring(0, {damping: 18, stiffness: 120});
    }
  }, [showEndCard, endCardO, endCardY]);
  const endCardStyle = useAnimatedStyle(() => ({
    opacity: endCardO.value,
    transform: [{translateY: endCardY.value}],
  }));

  // Cursor blink
  const cursorO = useSharedValue(1);
  useEffect(() => {
    if (phase === 'story' && !completedRef.current) {
      cursorO.value = withRepeat(
        withSequence(
          withTiming(0, {duration: 420}),
          withTiming(1, {duration: 420}),
        ),
        -1,
        false,
      );
    } else {
      cursorO.value = withTiming(0, {duration: 200});
    }
  }, [phase, cursorO]);
  const cursorStyle = useAnimatedStyle(() => ({opacity: cursorO.value}));

  // ── Cross-fade between phases ──────────────────────
  const phaseO = useSharedValue(1);
  const transitionTo = useCallback(
    (next: Phase) => {
      phaseO.value = withTiming(0, {duration: 180}, () => {
        phaseO.value = withTiming(1, {duration: 300});
      });
      setTimeout(() => setPhase(next), 200);
    },
    [phaseO],
  );
  const phaseStyle = useAnimatedStyle(() => ({opacity: phaseO.value}));

  // ── Promise phase entrance stagger ─────────────────
  const eyebrowO = useSharedValue(0);
  const nameY = useSharedValue(14);
  const nameO = useSharedValue(0);
  const line1O = useSharedValue(0);
  const line1Y = useSharedValue(14);
  const accentO = useSharedValue(0);
  const accentY = useSharedValue(14);
  const ctaO = useSharedValue(0);
  const ctaY = useSharedValue(22);

  useEffect(() => {
    if (phase !== 'promise') return;
    eyebrowO.value = withTiming(1, {duration: 500});
    nameO.value = withDelay(600, withTiming(1, {duration: 500}));
    nameY.value = withDelay(600, withSpring(0, {damping: 20, stiffness: 130}));
    line1O.value = withDelay(1000, withTiming(1, {duration: 500}));
    line1Y.value = withDelay(
      1000,
      withSpring(0, {damping: 20, stiffness: 130}),
    );
    accentO.value = withDelay(1500, withTiming(1, {duration: 500}));
    accentY.value = withDelay(
      1500,
      withSpring(0, {damping: 20, stiffness: 130}),
    );
    ctaO.value = withDelay(2600, withTiming(1, {duration: 500}));
    ctaY.value = withDelay(2600, withSpring(0, {damping: 18, stiffness: 140}));
  }, [phase, eyebrowO, nameO, nameY, line1O, line1Y, accentO, accentY, ctaO, ctaY]);

  const sEyebrow = useAnimatedStyle(() => ({opacity: eyebrowO.value}));
  const sName = useAnimatedStyle(() => ({
    opacity: nameO.value,
    transform: [{translateY: nameY.value}],
  }));
  const sLine1 = useAnimatedStyle(() => ({
    opacity: line1O.value,
    transform: [{translateY: line1Y.value}],
  }));
  const sAccent = useAnimatedStyle(() => ({
    opacity: accentO.value,
    transform: [{translateY: accentY.value}],
  }));
  const sCta = useAnimatedStyle(() => ({
    opacity: ctaO.value,
    transform: [{translateY: ctaY.value}],
  }));

  // Progress bar position per phase
  const progressCurrent = phase === 'promise' ? 3 : 4;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <OBProgressBar current={progressCurrent} total={7} />

      {phase === 'promise' ? (
        <Animated.View style={[StyleSheet.absoluteFill, phaseStyle]}>
          {/* Ken Burns full-bleed monument */}
          <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
            <Image
              source={{uri: heroImage}}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          </Animated.View>
          <LinearGradient
            colors={['transparent', 'rgba(7,6,12,0.5)', 'rgba(7,6,12,0.96)']}
            locations={[0, 0.45, 0.9]}
            style={StyleSheet.absoluteFillObject}
          />
          <DustMotes />

          <View
            style={[
              styles.promiseSheetWrap,
              {paddingBottom: insets.bottom + 28},
            ]}>
            <GlassCard radius={RADIUS.xl} style={styles.promiseSheet}>
              <View style={styles.promiseSheetContent}>
                <Animated.Text style={[styles.eyebrow, sEyebrow]}>
                  CHAPTER IV · THE CONNECTION
                </Animated.Text>
                <Animated.Text style={[styles.promiseName, sName]}>
                  {firstName || 'Explorer'}.
                </Animated.Text>
                <Animated.Text style={[styles.promiseLine, sLine1]}>
                  Somewhere in history, someone from your lineage stood where
                  you're about to stand.
                </Animated.Text>
                <Animated.Text style={[styles.promiseAccent, sAccent]}>
                  Let us introduce you.
                </Animated.Text>
                <Animated.View style={[styles.promiseCta, sCta]}>
                  <OBPrimaryButton
                    label={"Meet them  →"}
                    onPress={() => transitionTo('loading')}
                  />
                </Animated.View>
              </View>
            </GlassCard>
          </View>
        </Animated.View>
      ) : null}

      {phase === 'loading' ? (
        <Animated.View style={[styles.loadingWrap, phaseStyle]}>
          <LoadingDots />
          <Text style={styles.loadingHeadline}>
            {STORY_WAIT_MESSAGES[waitMsgIdx]}
          </Text>
          <Text style={styles.loadingSub}>
            {firstName
              ? `${firstName}, your story is being crafted with verified historical records.`
              : 'Your story is being crafted with verified historical records.'}
          </Text>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>
              {STORY_WAIT_STEPS[waitStepIdx]}
            </Text>
          </View>
          <View style={styles.shimmerGroup}>
            <ShimmerLine width={SCREEN_WIDTH - 48} />
            <ShimmerLine width={(SCREEN_WIDTH - 48) * 0.85} delay={200} />
            <ShimmerLine width={(SCREEN_WIDTH - 48) * 0.7} delay={400} />
          </View>
        </Animated.View>
      ) : null}

      {phase === 'story' ? (
        <Animated.View style={[styles.storyWrap, phaseStyle]}>
          <View style={styles.storyImageHeader}>
            <Image
              source={{uri: heroImage}}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(7,6,12,0.92)']}
              style={styles.imageGradient}>
              {demoMonument ? (
                <Text style={styles.monumentName}>{demoMonument}</Text>
              ) : null}
            </LinearGradient>
          </View>

          <View style={styles.storyBody}>
            <Text style={styles.storyEyebrow}>YOUR ANCESTOR</Text>
            <ScrollView
              style={styles.storyScroll}
              contentContainerStyle={styles.storyScrollContent}
              showsVerticalScrollIndicator={false}>
              <Text style={styles.storyText}>
                {demoStory}
                {!completedRef.current ? (
                  <Animated.Text style={cursorStyle}> |</Animated.Text>
                ) : null}
              </Text>
            </ScrollView>
          </View>

          {showEndCard ? (
            <Animated.View
              style={[
                styles.endCard,
                {paddingBottom: insets.bottom + 24},
                endCardStyle,
              ]}>
              <Text style={styles.endCardText}>
                {firstName || 'You'}, this ancestor shares your lineage.
              </Text>
              <OBPrimaryButton
                label={"This is real. Find mine.  →"}
                onPress={() =>
                  navigation.navigate(ROUTES.ONBOARDING.OB09_REACTION)
                }
              />
              <Text style={styles.disclaimer}>
                EVERY STORY IS GROUNDED IN HISTORIAN-VERIFIED RECORDS
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG.deep,
  },
  // Promise phase
  promiseSheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
  },
  promiseSheet: {
    overflow: 'hidden',
  },
  promiseSheetContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xl,
  },
  eyebrow: {
    ...TYPE.uiTiny,
    color: GOLD.text,
    letterSpacing: 2.4,
  },
  promiseName: {
    ...TYPE.displayLarge,
    fontSize: 34,
    lineHeight: 42,
    marginTop: SPACING.md,
  },
  promiseLine: {
    ...TYPE.uiMedium,
    color: TEXT.secondary,
    marginTop: SPACING.md,
  },
  promiseAccent: {
    ...TYPE.displayItalic,
    color: GOLD.text,
    fontSize: 18,
    lineHeight: 26,
    marginTop: SPACING.md,
  },
  promiseCta: {
    marginTop: SPACING.xxl,
    marginHorizontal: -SPACING.xxl,
  },
  // Loading phase
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GOLD.primary,
  },
  loadingHeadline: {
    ...TYPE.displayMedium,
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
    color: GOLD.text,
  },
  loadingSub: {
    ...TYPE.uiSmall,
    color: TEXT.secondary,
    textAlign: 'center',
    marginHorizontal: SPACING.md,
  },
  stepPill: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: BORDER.gold,
    backgroundColor: GOLD.subtle,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
  },
  stepPillText: {
    ...TYPE.uiTiny,
    color: GOLD.text,
    letterSpacing: 1.6,
  },
  shimmerGroup: {
    width: '100%',
    gap: 12,
    marginTop: SPACING.lg,
    alignItems: 'flex-start',
  },
  shimmerBar: {
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  shimmerSweep: {
    width: 200,
    height: '100%',
  },
  // Story phase
  storyWrap: {
    flex: 1,
  },
  storyImageHeader: {
    height: SCREEN_HEIGHT * 0.35,
    backgroundColor: BG.stone,
  },
  imageGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  monumentName: {
    ...TYPE.displayMedium,
    fontSize: 20,
    lineHeight: 26,
  },
  storyBody: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  storyEyebrow: {
    ...TYPE.uiTiny,
    color: GOLD.text,
    letterSpacing: 2.4,
    marginBottom: SPACING.sm,
  },
  storyScroll: {
    flex: 1,
    marginTop: SPACING.sm,
  },
  storyScrollContent: {
    paddingBottom: 220,
  },
  storyText: {
    fontFamily: DISPLAY_FONTS.regular,
    fontSize: 16,
    lineHeight: 28,
    color: '#F0EBD8',
  },
  endCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BG.deep,
    paddingTop: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: BORDER.gold,
  },
  endCardText: {
    ...TYPE.displayItalic,
    color: TEXT.secondary,
    textAlign: 'center',
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.lg,
  },
  disclaimer: {
    ...TYPE.uiTiny,
    color: TEXT.dim,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginHorizontal: SPACING.xxl,
    letterSpacing: 1.2,
  },
});

export default OB07_Promise;
