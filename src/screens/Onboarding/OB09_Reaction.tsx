import React, {useCallback, useEffect} from 'react';
import {View, Text, StyleSheet, StatusBar, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BookOpen, Zap, Heart, Compass} from 'lucide-react-native';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {ROUTES} from '../../core/constants/routes';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import GlassCard from '../../components/onboarding/GlassCard';
import {
  BG,
  GOLD,
  TEXT,
  TYPE,
  SPACING,
  RADIUS,
  BORDER,
} from '../../constants/onboarding';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB09_Reaction'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const REACTIONS = [
  {
    id: 'mind_blown',
    Icon: Zap,
    label: 'Mind-blowing',
    sub: 'I never thought of it that way.',
  },
  {
    id: 'emotional',
    Icon: Heart,
    label: 'Emotional',
    sub: 'It felt personal.',
  },
  {
    id: 'curious',
    Icon: Compass,
    label: 'I want more',
    sub: 'Show me everything.',
  },
] as const;

const OB09_Reaction: React.FC<Props> = ({navigation}) => {
  const {demoStory, reactionEmoji} = useOnboardingStore();
  const setReaction = useOnboardingStore(s => s.setReaction);
  const insets = useSafeAreaInsets();

  const previewText =
    demoStory.length > 150 ? demoStory.slice(0, 150) + '…' : demoStory;

  const previewO = useSharedValue(0);
  const headingO = useSharedValue(0);
  const headingY = useSharedValue(14);
  const tilesO = useSharedValue(0);

  useEffect(() => {
    previewO.value = withTiming(1, {duration: 500});
    headingO.value = withDelay(250, withTiming(1, {duration: 500}));
    headingY.value = withDelay(250, withSpring(0, {damping: 20, stiffness: 140}));
    tilesO.value = withDelay(500, withTiming(1, {duration: 500}));
  }, [previewO, headingO, headingY, tilesO]);

  const sPreview = useAnimatedStyle(() => ({opacity: previewO.value}));
  const sHeading = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));
  const sTiles = useAnimatedStyle(() => ({opacity: tilesO.value}));

  const handleReaction = useCallback(
    (id: string) => {
      setReaction(id);
      try {
        ReactNativeHapticFeedback.trigger('impactMedium', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } catch {}
      track('onboarding_story_reaction', {reaction: id});
    },
    [setReaction],
  );

  return (
    <LinearGradient
      colors={[BG.deep, BG.warm, '#000000']}
      locations={[0, 0.6, 1]}
      style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View style={styles.ambientGlow} pointerEvents="none" />

      <OBProgressBar current={6} total={7} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        {/* Story preview */}
        <Animated.View style={[styles.previewBlock, sPreview]}>
          <View style={styles.chapterPill}>
            <BookOpen size={12} color={GOLD.text} />
            <Text style={styles.chapterPillText}>YOUR ANCESTOR'S STORY</Text>
          </View>

          <GlassCard variant="stone" radius={RADIUS.lg} style={styles.previewCard}>
            <Text style={styles.previewText} numberOfLines={4}>
              {previewText}
            </Text>
            <LinearGradient
              colors={['transparent', BG.stone]}
              style={styles.previewFade}
              pointerEvents="none"
            />
          </GlassCard>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={[styles.headingBlock, sHeading]}>
          <Text style={styles.headingSetup}>How did that</Text>
          <Text style={styles.headingPunchline}>feel?</Text>
          <Text style={styles.headingSub}>
            Your reaction shapes what we show you next.
          </Text>
        </Animated.View>

        {/* Reaction tiles */}
        <Animated.View style={[styles.tileStack, sTiles]}>
          {REACTIONS.map(r => (
            <OBSelectionTile
              key={r.id}
              layout="stack"
              icon={
                <r.Icon
                  size={24}
                  color={reactionEmoji === r.id ? GOLD.primary : TEXT.muted}
                />
              }
              label={r.label}
              sublabel={r.sub}
              selected={reactionEmoji === r.id}
              onPress={() => handleReaction(r.id)}
            />
          ))}
        </Animated.View>

        <OBPrimaryButton
          label={"Continue  →"}
          onPress={() =>
            navigation.navigate(ROUTES.ONBOARDING.OB10_SIGNUP, {
              fromOnboarding: true,
            })
          }
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    top: 160,
    left: -(SCREEN_WIDTH * 0.2),
    width: SCREEN_WIDTH * 1.4,
    height: 220,
    borderRadius: 9999,
    backgroundColor: GOLD.subtle,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
  },
  previewBlock: {
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.md,
  },
  chapterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: GOLD.subtle,
    borderWidth: 1,
    borderColor: BORDER.gold,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  chapterPillText: {
    ...TYPE.uiTiny,
    color: GOLD.text,
    letterSpacing: 1.4,
  },
  previewCard: {
    padding: SPACING.lg,
    overflow: 'hidden',
  },
  previewText: {
    ...TYPE.storyBody,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 22,
  },
  previewFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
  },
  headingBlock: {
    paddingHorizontal: SPACING.xxl,
  },
  headingSetup: {
    ...TYPE.uiMedium,
    color: TEXT.secondary,
  },
  headingPunchline: {
    ...TYPE.displayHero,
    fontSize: 36,
    lineHeight: 44,
    marginTop: 2,
  },
  headingSub: {
    ...TYPE.uiSmall,
    color: TEXT.muted,
    marginTop: SPACING.sm,
  },
  tileStack: {
    gap: SPACING.md,
  },
});

export default OB09_Reaction;
