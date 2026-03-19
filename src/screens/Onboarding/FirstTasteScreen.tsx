import React, { useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import MonumentCard from '../../components/onboarding/MonumentCard';
import AmberButton from '../../components/onboarding/AmberButton';
import {
  ANCESTOR_STORIES,
  DEFAULT_STORY_REGION,
  MONUMENT_DATA_MAP,
} from '../../constants/onboarding/ancestorStories';
import { COLORS, SPACING } from '../../core/constants/theme';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'FirstTaste'>;

/**
 * Screen 4 — The highest-stakes screen.
 * Shows the monument card for the user's chosen region with Ken Burns animation
 * and typewriter story reveal. After the story completes + 1s, CTA button fades in.
 * CDN image and monument name are region-specific.
 */
const FirstTasteScreen: React.FC<Props> = ({ navigation, route }) => {
  const { region } = route.params;
  const [showCta, setShowCta] = useState(false);

  const ctaOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(24);

  const storyRegion = region ?? DEFAULT_STORY_REGION;
  const story =
    ANCESTOR_STORIES[storyRegion] ?? ANCESTOR_STORIES[DEFAULT_STORY_REGION];

  // Get the monument specific to the selected region
  const monument =
    MONUMENT_DATA_MAP[storyRegion] ?? MONUMENT_DATA_MAP[DEFAULT_STORY_REGION];

  const handleTypewriterComplete = useCallback(() => {
    // 1s delay after typewriter completes, then fade + slide the CTA in
    setTimeout(() => {
      setShowCta(true);
      ctaOpacity.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.ease),
      });
      ctaTranslateY.value = withTiming(0, {
        duration: 600,
        easing: Easing.out(Easing.ease),
      });
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
          monumentName={monument.name}
          year={monument.year}
          imageUrl={monument.imageUrl}
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
    backgroundColor: COLORS.bgWarm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  ctaContainer: {
    marginTop: SPACING.xxxl,
  },
});

export default FirstTasteScreen;
