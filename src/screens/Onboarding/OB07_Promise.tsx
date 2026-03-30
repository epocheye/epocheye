import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OB_COLORS } from '../../constants/onboarding';
import { FONTS } from '../../core/constants/theme';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { streamAncestorStory } from '../../services/ancestorStoryService';
import { getFallbackStory } from '../../services/fallbackStories';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB07_Promise'>;

const OB07_Promise: React.FC<Props> = ({ navigation }) => {
  const { firstName, regions, motivation, visitFrequency, goal } =
    useOnboardingStore();
  const appendStoryChunk = useOnboardingStore(s => s.appendStoryChunk);
  const setDemoMonument = useOnboardingStore(s => s.setDemoMonument);
  const insets = useSafeAreaInsets();
  const [showCta, setShowCta] = useState(false);
  const apiStarted = useRef(false);

  // Text stagger
  const t1 = useSharedValue(0);
  const t2 = useSharedValue(0);
  const t3 = useSharedValue(0);
  const t4 = useSharedValue(0);

  useEffect(() => {
    t1.value = withTiming(1, { duration: 400 });
    t2.value = withDelay(500, withTiming(1, { duration: 400 }));
    t3.value = withDelay(900, withTiming(1, { duration: 400 }));
    t4.value = withDelay(1400, withTiming(1, { duration: 400 }));

    const timer = setTimeout(() => setShowCta(true), 2500);
    return () => clearTimeout(timer);
  }, [t1, t2, t3, t4]);

  // Fire API call on mount
  useEffect(() => {
    if (apiStarted.current) {
      return;
    }
    apiStarted.current = true;

    // Reset story state before starting
    useOnboardingStore.setState({ demoStory: '', demoMonument: '' });

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
  const s1 = useAnimatedStyle(() => ({ opacity: t1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: t2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: t3.value }));
  const s4 = useAnimatedStyle(() => ({ opacity: t4.value }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={6} total={10} />

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.centerArea}>
          <View style={styles.silhouetteWrap}>
            <AnimatedLogo size={116} motion="orbit" variant="white" />
          </View>

          <Animated.Text style={[styles.nameText, s1]}>
            {firstName}.
          </Animated.Text>
          <Animated.Text style={[styles.greyText, s2]}>
            Somewhere in history, someone from
          </Animated.Text>
          <Animated.Text style={[styles.greyText, s3]}>
            your lineage stood where you're about to stand.
          </Animated.Text>
          <Animated.Text style={[styles.accentText, s4]}>
            Let us introduce you.
          </Animated.Text>
        </View>

        {showCta && (
          <OBPrimaryButton
            label="Meet them →"
            onPress={() => navigation.navigate('OB08_DemoStory')}
          />
        )}
      </View>
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
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  silhouetteWrap: {
    width: 132,
    height: 132,
    marginBottom: 32,
    borderRadius: 66,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
    marginBottom: 12,
  },
  greyText: {
    fontSize: 15,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  accentText: {
    fontSize: 16,
    color: '#E8A020',
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginTop: 12,
    textAlign: 'center',
  },
});

export default OB07_Promise;
