import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, BookOpen } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { FONTS } from '../../core/constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import { track } from '../../services/analytics';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB09_Reaction'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TILE_WIDTH = (SCREEN_WIDTH - 48 - 20) / 3;

const REACTIONS = [
  { id: '🤯', emoji: '🤯', label: 'Mind-blowing', sub: 'Whoa' },
  { id: '🥹', emoji: '🥹', label: 'Emotional', sub: 'Moved' },
  { id: '🔍', emoji: '🔍', label: 'I want more', sub: 'Curious' },
] as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ReactionTileProps {
  emoji: string;
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}

const ReactionTile: React.FC<ReactionTileProps> = ({
  emoji,
  label,
  sub,
  selected,
  onPress,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 80 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(selected ? 1.03 : 1, {
      damping: 14,
      stiffness: 260,
    });
  };

  return (
    <AnimatedPressable
      style={[
        styles.tile,
        {
          backgroundColor: selected ? 'rgba(232,160,32,0.13)' : '#141414',
          borderColor: selected ? '#E8A020' : 'rgba(255,255,255,0.1)',
          borderWidth: selected ? 1.5 : 1,
        },
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      {selected && (
        <View style={styles.checkBadge}>
          <CheckCircle size={14} color="#E8A020" />
        </View>
      )}
      <Text style={styles.tileEmoji}>{emoji}</Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </AnimatedPressable>
  );
};

const OB09_Reaction: React.FC<Props> = ({ navigation }) => {
  const { demoStory, demoMonument, reactionEmoji } = useOnboardingStore();
  const setReaction = useOnboardingStore(s => s.setReaction);
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<ConfettiCannon | null>(null);

  const previewText =
    demoStory.length > 130 ? demoStory.slice(0, 130) + '...' : demoStory;
  const subject = demoMonument || 'Ancestor story and heritage monument';

  const handleReaction = useCallback(
    (id: string) => {
      setReaction(id);
      try {
        ReactNativeHapticFeedback.trigger('impactMedium', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } catch {}
      // Defer heavy work so the tile scale animation runs uninterrupted
      requestAnimationFrame(() => {
        confettiRef.current?.start();
        track('onboarding_story_reaction', { reaction: id });
      });
    },
    [setReaction],
  );

  return (
    <LinearGradient
      colors={['#0D0B08', '#0F0D0A', '#0A0A0A']}
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Atmospheric amber glow */}
      <View style={styles.ambientGlow} />

      <OBProgressBar current={8} total={10} />

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Story preview */}
        <View style={styles.previewSection}>
          <View style={styles.chapterPill}>
            <BookOpen size={12} color="#E8A020" />
            <Text style={styles.chapterPillText}>YOUR ANCESTOR'S STORY</Text>
          </View>
          <View style={styles.previewCard}>
            <Text style={styles.previewText} numberOfLines={4}>
              {previewText}
            </Text>
            <LinearGradient
              colors={['transparent', '#13110A']}
              style={styles.previewFade}
            />
          </View>
        </View>

        <View style={styles.visualWrap}>
          <OnboardingResolvedVisual
            subject={subject}
            context="onboarding reaction story context"
            height={140}
          />
        </View>

        {/* Heading */}
        <View style={styles.headingBlock}>
          <Text style={styles.headingSetup}>How did that</Text>
          <Text style={styles.headingPunchline}>feel?</Text>
          <Text style={styles.headingSub}>
            Your reaction shapes what we show you next.
          </Text>
        </View>

        {/* Reaction tiles */}
        <View style={styles.tilesRow}>
          {REACTIONS.map(r => (
            <ReactionTile
              key={r.id}
              emoji={r.emoji}
              label={r.label}
              sub={r.sub}
              selected={reactionEmoji === r.id}
              onPress={() => handleReaction(r.id)}
            />
          ))}
        </View>

        <Text style={styles.socialProof}>
          Join thousands tracing their ancestry through living monuments.
        </Text>

        <OBPrimaryButton
          label="Continue →"
          onPress={() =>
            navigation.navigate('OB10_SignUp', { fromOnboarding: true })
          }
        />
      </View>

      <ConfettiCannon
        ref={confettiRef}
        count={80}
        origin={{ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT * 0.6 }}
        colors={['#E8A020', '#FFFFFF', '#FFD700', '#F5C842']}
        autoStart={false}
        fadeOut
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    top: 140,
    left: -(SCREEN_WIDTH * 0.2),
    width: SCREEN_WIDTH * 1.4,
    height: 220,
    borderRadius: 9999,
    backgroundColor: 'rgba(232,160,32,0.07)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  previewSection: {
    paddingHorizontal: 24,
    gap: 10,
  },
  visualWrap: {
    paddingHorizontal: 24,
  },
  chapterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,160,32,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chapterPillText: {
    fontSize: 10,
    letterSpacing: 1,
    color: '#E8A020',
    fontFamily: FONTS.semiBold,
  },
  previewCard: {
    padding: 16,
    backgroundColor: '#13110A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    overflow: 'hidden',
  },
  previewText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#F0EBD8',
    fontFamily: FONTS.mediumItalic,
  },
  previewFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
  },
  headingBlock: {
    paddingHorizontal: 24,
  },
  headingSetup: {
    fontSize: 16,
    lineHeight: 22,
    color: '#B8AF9E',
    fontFamily: FONTS.medium,
  },
  headingPunchline: {
    fontSize: 34,
    lineHeight: 40,
    color: '#F5F0E8',
    fontFamily: FONTS.extraBold,
    marginTop: 2,
  },
  headingSub: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5A5248',
    fontFamily: FONTS.regular,
    marginTop: 6,
  },
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  tile: {
    width: TILE_WIDTH,
    height: 120,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  tileEmoji: {
    fontSize: 36,
    lineHeight: 44,
  },
  tileLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: '#F5F0E8',
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  tileSub: {
    fontSize: 10,
    lineHeight: 14,
    color: '#7A7065',
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  socialProof: {
    color: '#8C8378',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginHorizontal: 24,
    fontFamily: FONTS.regular,
  },
});

export default OB09_Reaction;
