import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StatusBar, Animated } from 'react-native';
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
    <View className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View className="flex-1 justify-center px-6">
        <Text className="text-center font-['CormorantGaramond-SemiBold'] text-[28px] leading-10 text-white">
          {mirrorText}
        </Text>

        {showPayoff && (
          <Animated.View className="mt-8" style={{ opacity: payoffFade }}>
            <Text className="text-center font-['DMSans-Regular'] text-[17px] leading-[26px] text-[rgba(255,255,255,0.75)]">
              EpochEye shows you who your ancestors were at the monument you're
              standing at. Right now. In real time.
            </Text>
          </Animated.View>
        )}

        {showCta && (
          <Animated.View className="mt-10 px-6" style={{ opacity: ctaFade }}>
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

export default MirrorMomentScreen;
