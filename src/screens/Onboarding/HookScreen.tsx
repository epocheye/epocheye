import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  Animated,
} from 'react-native';
import DustMotes from '../../components/onboarding/DustMotes';
import AmberButton from '../../components/onboarding/AmberButton';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'Hook'>;

/**
 * Screen 2 — Emotional hook (merged EmotionalQuestion + MirrorMoment).
 * Step 1: Question with two answer cards.
 * Step 2: Conditional mirror text + payoff + CTA.
 * All in one screen with smooth crossfade transitions.
 */
const HookScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<'question' | 'mirror'>('question');
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  const [showPayoff, setShowPayoff] = useState(false);
  const [showCta, setShowCta] = useState(false);

  const questionOpacity = useRef(new Animated.Value(1)).current;
  const mirrorOpacity = useRef(new Animated.Value(0)).current;
  const payoffOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  const handleAnswer = useCallback(
    (selected: 'yes' | 'no') => {
      setAnswer(selected);

      // Crossfade from question to mirror
      Animated.timing(questionOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setStep('mirror');
        Animated.timing(mirrorOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      });
    },
    [questionOpacity, mirrorOpacity],
  );

  // Timed reveals for mirror step
  useEffect(() => {
    if (step !== 'mirror') return;

    const payoffTimer = setTimeout(() => {
      setShowPayoff(true);
      Animated.timing(payoffOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1400);

    const ctaTimer = setTimeout(() => {
      setShowCta(true);
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 2800);

    return () => {
      clearTimeout(payoffTimer);
      clearTimeout(ctaTimer);
    };
  }, [step, payoffOpacity, ctaOpacity]);

  const mirrorText =
    answer === 'yes'
      ? "That's not you.\nThat's the wrong story being told."
      : 'Imagine if it moved you\n10 times more.';

  const payoffText =
    "EpochEye shows you who your ancestors were — at the monument you're standing at. Right now.";

  return (
    <View className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <DustMotes />

      <View className="flex-1 justify-center px-8">
        {/* Step 1: Question */}
        {step === 'question' && (
          <Animated.View
            className="items-center"
            style={{ opacity: questionOpacity }}
          >
            <Text className="mb-10 max-w-[320px] text-center font-['MontserratAlternates-SemiBold'] text-[32px] leading-[38px] text-[#F5E9D8]">
              Have you ever stood at a monument and felt… nothing?
            </Text>

            <View className="w-full gap-5">
              <TouchableOpacity
                className="h-14 w-full items-center justify-center rounded-xl border border-[rgba(255,255,255,0.2)] bg-[#241D16]"
                activeOpacity={0.7}
                onPress={() => handleAnswer('yes')}
              >
                <Text className="font-['MontserratAlternates-Medium'] text-lg text-[#F5E9D8]">
                  Yes, honestly
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="h-14 w-full items-center justify-center rounded-xl border border-[rgba(255,255,255,0.2)] bg-[#241D16]"
                activeOpacity={0.7}
                onPress={() => handleAnswer('no')}
              >
                <Text className="font-['MontserratAlternates-Medium'] text-lg text-[#F5E9D8]">
                  No, history moves me
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Step 2: Mirror + Payoff + CTA */}
        {step === 'mirror' && (
          <Animated.View
            className="items-center px-2"
            style={{ opacity: mirrorOpacity }}
          >
            <Text className="text-center font-['MontserratAlternates-SemiBold'] text-[28px] leading-[34px] text-[#F5E9D8]">
              {mirrorText}
            </Text>

            {showPayoff && (
              <Animated.View
                className="mt-7"
                style={{ opacity: payoffOpacity }}
              >
                <Text className="text-center font-['MontserratAlternates-Regular'] text-[15px] leading-6 text-[#B8AF9E]">
                  {payoffText}
                </Text>
              </Animated.View>
            )}

            {showCta && (
              <Animated.View
                className="mt-10 w-full px-8"
                style={{ opacity: ctaOpacity }}
              >
                <AmberButton
                  title="Show me how"
                  onPress={() =>
                    navigation.navigate(ROUTES.ONBOARDING.ANCESTRY_INPUT)
                  }
                />
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>
    </View>
  );
};

export default HookScreen;
