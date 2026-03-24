import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StatusBar, Animated } from 'react-native';
import { useOnboardingComplete } from '../../context/OnboardingCallbackContext';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'WorldOpens'>;

/**
 * Screen 8 — World Opens (Heritage Map Entry).
 * Shows an animated amber banner that slides up, stays 4 seconds, then exits.
 * After the banner exits, calls onOnboardingComplete() from the root navigator
 * context to conditionally render MainNavigation instead of OnboardingNavigator.
 * No tutorial, no tooltips, no overlays.
 */
const WorldOpensScreen: React.FC<Props> = () => {
  const bannerTranslateY = useRef(new Animated.Value(80)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const onOnboardingComplete = useOnboardingComplete();

  const completeOnboarding = useCallback(() => {
    onOnboardingComplete();
  }, [onOnboardingComplete]);

  useEffect(() => {
    // Slide banner up
    Animated.parallel([
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // After 4 seconds, slide banner back down then switch to main app
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(bannerTranslateY, {
          toValue: 80,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        completeOnboarding();
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, [bannerTranslateY, bannerOpacity, completeOnboarding]);

  return (
    <View className="flex-1 items-center justify-end bg-[#1A1612] pb-[60px]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <Animated.View
        className="max-w-[85%] rounded-[30px] bg-[rgba(212,134,10,0.92)] px-6 py-3.5"
        style={[
          {
            transform: [{ translateY: bannerTranslateY }],
            opacity: bannerOpacity,
          },
        ]}
      >
        <Text className="text-center font-['DMSans-Medium'] text-[15px] text-white">
          You're 2.3km from a story that belongs to you.
        </Text>
      </Animated.View>
    </View>
  );
};

export default WorldOpensScreen;
