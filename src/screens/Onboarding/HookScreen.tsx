import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
} from 'react-native';
import DustMotes from '../../components/onboarding/DustMotes';
import AmberButton from '../../components/onboarding/AmberButton';
import {
  FONTS,
  COLORS,
  FONT_SIZES,
  SPACING,
  RADIUS,
} from '../../core/constants/theme';
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
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <DustMotes />

      <View style={styles.content}>
        {/* Step 1: Question */}
        {step === 'question' && (
          <Animated.View
            style={[styles.questionContainer, { opacity: questionOpacity }]}
          >
            <Text style={styles.question}>
              Have you ever stood at a monument and felt… nothing?
            </Text>

            <View style={styles.cards}>
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => handleAnswer('yes')}
              >
                <Text style={styles.cardText}>Yes, honestly</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => handleAnswer('no')}
              >
                <Text style={styles.cardText}>No, history moves me</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Step 2: Mirror + Payoff + CTA */}
        {step === 'mirror' && (
          <Animated.View
            style={[styles.mirrorContainer, { opacity: mirrorOpacity }]}
          >
            <Text style={styles.mirrorText}>{mirrorText}</Text>

            {showPayoff && (
              <Animated.View style={{ opacity: payoffOpacity, marginTop: 28 }}>
                <Text style={styles.payoffText}>{payoffText}</Text>
              </Animated.View>
            )}

            {showCta && (
              <Animated.View
                style={[styles.ctaContainer, { opacity: ctaOpacity }]}
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
  questionContainer: {
    alignItems: 'center',
  },
  question: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.heading,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
    maxWidth: 320,
    marginBottom: SPACING.section,
  },
  cards: {
    width: '100%',
    gap: SPACING.lg,
  },
  card: {
    width: '100%',
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.button,
    color: COLORS.textPrimary,
  },
  mirrorContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  mirrorText: {
    fontFamily: FONTS.semiBold,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
  },
  payoffText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  ctaContainer: {
    marginTop: SPACING.section,
    width: '100%',
    paddingHorizontal: SPACING.xxl,
  },
});

export default HookScreen;
