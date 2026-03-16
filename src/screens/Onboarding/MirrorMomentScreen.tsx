import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Animated } from 'react-native';
import AmberButton from '../../components/onboarding/AmberButton';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'MirrorMoment'>;

/**
 * Screen 3 — Conditional response based on the user's answer.
 * Shows a payoff line after 1.2s, then a CTA button.
 */
const MirrorMomentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { answer } = route.params;
  const [showPayoff, setShowPayoff] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const payoffFade = useRef(new Animated.Value(0)).current;
  const ctaFade = useRef(new Animated.Value(0)).current;

  const mirrorText =
    answer === 'yes'
      ? "That's not you. That's the wrong story being told.\nHistory only hits different when it's yours."
      : 'Imagine if it moved you 10 times more.\nImagine if it was your story.';

  useEffect(() => {
    // After 1.2s, fade in payoff line
    const payoffTimer = setTimeout(() => {
      setShowPayoff(true);
      Animated.timing(payoffFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1200);

    // After 2.4s, fade in CTA
    const ctaTimer = setTimeout(() => {
      setShowCta(true);
      Animated.timing(ctaFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 2400);

    return () => {
      clearTimeout(payoffTimer);
      clearTimeout(ctaTimer);
    };
  }, [payoffFade, ctaFade]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View style={styles.content}>
        <Text style={styles.mirrorText}>{mirrorText}</Text>

        {showPayoff && (
          <Animated.View style={{ opacity: payoffFade, marginTop: 32 }}>
            <Text style={styles.payoffText}>
              EpochEye shows you who your ancestors were at the monument you're
              standing at. Right now. In real time.
            </Text>
          </Animated.View>
        )}

        {showCta && (
          <Animated.View style={[styles.ctaContainer, { opacity: ctaFade }]}>
            <AmberButton
              title="Show me how"
              onPress={() =>
                navigation.navigate(ROUTES.ONBOARDING.ANCESTRY_INPUT)
              }
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
    paddingHorizontal: 24,
  },
  mirrorText: {
    fontFamily: 'CormorantGaramond-SemiBold',
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
  },
  payoffText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 17,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 26,
  },
  ctaContainer: {
    marginTop: 40,
    paddingHorizontal: 24,
  },
});

export default MirrorMomentScreen;
