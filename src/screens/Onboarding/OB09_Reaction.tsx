import React, {useRef} from 'react';
import {View, Text, StyleSheet, StatusBar, Dimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Sparkles, Heart, Search} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {OB_COLORS, OB_TYPOGRAPHY} from '../../constants/onboarding';
import {FONTS} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB09_Reaction'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const TILE_WIDTH = (SCREEN_WIDTH - 48 - 20) / 3;

const REACTIONS = [
  {id: '🤯', label: 'Mind-blowing', Icon: Sparkles},
  {id: '🥹', label: 'Emotional', Icon: Heart},
  {id: '🔍', label: 'I want more', Icon: Search},
] as const;

const OB09_Reaction: React.FC<Props> = ({navigation}) => {
  const {demoStory, reactionEmoji} = useOnboardingStore();
  const setReaction = useOnboardingStore((s) => s.setReaction);
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<ConfettiCannon | null>(null);

  const previewText =
    demoStory.length > 120 ? demoStory.slice(0, 120) + '...' : demoStory;

  const handleReaction = (id: string) => {
    setReaction(id);
    track('onboarding_story_reaction', {reaction: id});

    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {}

    confettiRef.current?.start();
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={8} total={10} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        {/* Scaled story preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewText} numberOfLines={3}>
            {previewText}
          </Text>
          <LinearGradient
            colors={['transparent', OB_COLORS.bg]}
            style={styles.previewFade}
          />
        </View>

        <Text style={[OB_TYPOGRAPHY.heading, styles.heading]}>
          How did that feel?
        </Text>

        {/* Reaction tiles */}
        <View style={styles.tilesRow}>
          {REACTIONS.map((r) => {
            const selected = reactionEmoji === r.id;
            return (
              <View key={r.id} style={{width: TILE_WIDTH}}>
                <OBSelectionTile
                  icon={
                    <r.Icon
                      size={24}
                      color={selected ? '#E8A020' : '#8C93A0'}
                    />
                  }
                  label={r.label}
                  selected={selected}
                  onPress={() => handleReaction(r.id)}
                  layout="grid"
                />
              </View>
            );
          })}
        </View>

        <Text style={styles.socialProof}>
          People are sharing their ancestors. Yours is waiting at a heritage
          site near you.
        </Text>

        <OBPrimaryButton
          label="Continue →"
          onPress={() => navigation.navigate('OB10_SignUp', {fromOnboarding: true})}
        />
      </View>

      <ConfettiCannon
        ref={confettiRef}
        count={80}
        origin={{x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT * 0.6}}
        colors={['#E8A020', '#FFFFFF', '#FFD700']}
        autoStart={false}
        fadeOut
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  previewCard: {
    marginHorizontal: 24,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    transform: [{scale: 0.88}],
    overflow: 'hidden',
  },
  previewText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#FFFFFF',
    fontFamily: FONTS.regular,
  },
  previewFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  heading: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  tilesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  socialProof: {
    color: '#8C93A0',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 24,
    fontFamily: FONTS.regular,
  },
});

export default OB09_Reaction;
