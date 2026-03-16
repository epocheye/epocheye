import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Animated } from 'react-native';
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
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <Animated.View
        style={[
          styles.banner,
          {
            transform: [{ translateY: bannerTranslateY }],
            opacity: bannerOpacity,
          },
        ]}
      >
        <Text style={styles.bannerText}>
          You're 2.3km from a story that belongs to you.
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1612',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  banner: {
    backgroundColor: 'rgba(212,134,10,0.92)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    maxWidth: '85%',
  },
  bannerText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default WorldOpensScreen;
