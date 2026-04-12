import React, {useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Pressable,
} from 'react-native';
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
import {CheckCircle, BookOpen, Zap, Heart, Search} from 'lucide-react-native';
import {FONTS} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB09_Reaction'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const TILE_WIDTH = (SCREEN_WIDTH - 48 - 20) / 3;

const REACTIONS = [
  {id: 'mind_blown', Icon: Zap, label: 'Mind-blowing', sub: 'Whoa'},
  {id: 'emotional', Icon: Heart, label: 'Emotional', sub: 'Moved'},
  {id: 'curious', Icon: Search, label: 'I want more', sub: 'Curious'},
] as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ReactionTileProps {
  Icon: React.FC<{size?: number; color?: string}>;
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}

const ReactionTile: React.FC<ReactionTileProps> = ({
  Icon,
  label,
  sub,
  selected,
  onPress,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.94, {duration: 60});
  };

  const handlePressOut = () => {
    scale.value = withSpring(selected ? 1.04 : 1, {
      damping: 12,
      stiffness: 260,
    });
  };

  return (
    <AnimatedPressable
      style={[
        styles.tile,
        {
          backgroundColor: selected ? 'rgba(232,160,32,0.12)' : 'rgba(255,255,255,0.04)',
          borderColor: selected ? 'rgba(232,160,32,0.7)' : 'rgba(255,255,255,0.08)',
          borderWidth: selected ? 1.5 : 1,
        },
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}>
      {selected && (
        <View style={styles.checkBadge}>
          <CheckCircle size={14} color="#E8A020" />
        </View>
      )}
      <Icon size={34} color={selected ? '#E8A020' : '#B8AF9E'} />
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </AnimatedPressable>
  );
};

const OB09_Reaction: React.FC<Props> = ({navigation}) => {
  const {demoStory, reactionEmoji} = useOnboardingStore();
  const setReaction = useOnboardingStore(s => s.setReaction);
  const insets = useSafeAreaInsets();

  const previewText =
    demoStory.length > 130 ? demoStory.slice(0, 130) + '...' : demoStory;

  // Entrance animations
  const previewO = useSharedValue(0);
  const headingO = useSharedValue(0);
  const headingY = useSharedValue(12);
  const tilesO = useSharedValue(0);

  useEffect(() => {
    previewO.value = withTiming(1, {duration: 400});
    headingO.value = withDelay(200, withTiming(1, {duration: 400}));
    headingY.value = withDelay(200, withSpring(0, {damping: 18, stiffness: 140}));
    tilesO.value = withDelay(400, withTiming(1, {duration: 400}));
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
      colors={['#0D0B08', '#0F0D0A', '#0A0A0A']}
      style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Atmospheric amber glow */}
      <View style={styles.ambientGlow} />

      <OBProgressBar current={8} total={10} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        {/* Story preview */}
        <Animated.View style={[styles.previewSection, sPreview]}>
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
        <Animated.View style={[styles.tilesRow, sTiles]}>
          {REACTIONS.map(r => (
            <ReactionTile
              key={r.id}
              Icon={r.Icon}
              label={r.label}
              sub={r.sub}
              selected={reactionEmoji === r.id}
              onPress={() => handleReaction(r.id)}
            />
          ))}
        </Animated.View>

        <Text style={styles.socialProof}>
          Join thousands tracing their ancestry through living monuments.
        </Text>

        <OBPrimaryButton
          label="Continue  \u2192"
          onPress={() =>
            navigation.navigate('OB10_SignUp', {fromOnboarding: true})
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
    top: 140,
    left: -(SCREEN_WIDTH * 0.2),
    width: SCREEN_WIDTH * 1.4,
    height: 220,
    borderRadius: 9999,
    backgroundColor: 'rgba(232,160,32,0.06)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  previewSection: {
    paddingHorizontal: 24,
    gap: 10,
  },
  chapterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,160,32,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.25)',
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
    borderColor: 'rgba(201,168,76,0.25)',
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
    paddingHorizontal: 28,
  },
  headingSetup: {
    fontSize: 16,
    lineHeight: 22,
    color: '#B8AF9E',
    fontFamily: FONTS.medium,
  },
  headingPunchline: {
    fontSize: 36,
    lineHeight: 42,
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
    gap: 5,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
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
    color: '#6B6357',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginHorizontal: 28,
    fontFamily: FONTS.regular,
  },
});

export default OB09_Reaction;
