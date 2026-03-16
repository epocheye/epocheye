import React, { useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import MonumentCard from '../../components/onboarding/MonumentCard';
import AmberButton from '../../components/onboarding/AmberButton';
import {
  ANCESTOR_STORIES,
  DEFAULT_STORY_REGION,
  MONUMENT_DATA,
} from '../../constants/onboarding/ancestorStories';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'FirstTaste'>;

/**
 * Screen 5 — The highest-stakes screen.
 * Shows a monument card with Ken Burns animation and typewriter story.
 * After typewriter completes + 1s delay, CTA button fades in.
 */
const FirstTasteScreen: React.FC<Props> = ({ navigation, route }) => {
  const { region } = route.params;
  const [showCta, setShowCta] = useState(false);

  const ctaOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(20);

  const storyRegion = region ?? DEFAULT_STORY_REGION;
  const story =
    ANCESTOR_STORIES[storyRegion] ?? ANCESTOR_STORIES[DEFAULT_STORY_REGION];

  const handleTypewriterComplete = useCallback(() => {
    // 1s delay after typewriter completes, then fade in CTA
    setTimeout(() => {
      setShowCta(true);
      ctaOpacity.value = withDelay(
        0,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
      );
      ctaTranslateY.value = withDelay(
        0,
        withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) }),
      );
    }, 1000);
  }, [ctaOpacity, ctaTranslateY]);

  const ctaAnimStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View style={styles.content}>
        <MonumentCard
          story={story}
          monumentName={MONUMENT_DATA.name}
          year={MONUMENT_DATA.year}
          onTypewriterComplete={handleTypewriterComplete}
        />

        {showCta && (
          <Animated.View style={[styles.ctaContainer, ctaAnimStyle]}>
            <AmberButton
              title="This is my story. Let me in."
              onPress={() => navigation.navigate(ROUTES.ONBOARDING.SIGNUP)}
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
    backgroundColor: '#1A1612',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  ctaContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
});

export default FirstTasteScreen;
