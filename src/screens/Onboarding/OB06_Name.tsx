import React, {useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useOnboardingStore} from '../../stores/onboardingStore';
import {ROUTES} from '../../core/constants/routes';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import GlassCard from '../../components/onboarding/GlassCard';
import {
  BG,
  GOLD,
  TEXT,
  TYPE,
  SPACING,
  RADIUS,
} from '../../constants/onboarding';
import {DISPLAY_FONTS} from '../../core/constants/fonts';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB06_Name'>;

const {width: SCREEN_WIDTH} = Dimensions.get('window');

const OB06_Name: React.FC<Props> = ({navigation}) => {
  const firstName = useOnboardingStore(s => s.firstName);
  const setFirstName = useOnboardingStore(s => s.setFirstName);
  const insets = useSafeAreaInsets();

  const headingO = useSharedValue(0);
  const headingY = useSharedValue(18);
  const cardO = useSharedValue(0);
  const cardY = useSharedValue(20);
  const previewO = useSharedValue(0);

  const underlineO = useSharedValue(0.4);
  const glowO = useSharedValue(0.4);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 500});
    headingY.value = withSpring(0, {damping: 20, stiffness: 140});
    cardO.value = withTiming(1, {duration: 600});
    cardY.value = withSpring(0, {damping: 20, stiffness: 130});

    underlineO.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 1600, easing: Easing.inOut(Easing.quad)}),
        withTiming(0.4, {duration: 1600, easing: Easing.inOut(Easing.quad)}),
      ),
      -1,
      false,
    );

    glowO.value = withRepeat(
      withSequence(
        withTiming(0.65, {duration: 2400, easing: Easing.inOut(Easing.quad)}),
        withTiming(0.25, {duration: 2400, easing: Easing.inOut(Easing.quad)}),
      ),
      -1,
      false,
    );
  }, [headingO, headingY, cardO, cardY, underlineO, glowO]);

  useEffect(() => {
    previewO.value = withTiming(firstName.trim().length >= 2 ? 1 : 0, {
      duration: 260,
    });
  }, [firstName, previewO]);

  const sHeading = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));
  const sCard = useAnimatedStyle(() => ({
    opacity: cardO.value,
    transform: [{translateY: cardY.value}],
  }));
  const sPreview = useAnimatedStyle(() => ({opacity: previewO.value}));
  const sUnderline = useAnimatedStyle(() => ({opacity: underlineO.value}));
  const sGlow = useAnimatedStyle(() => ({opacity: glowO.value}));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Ambient gold radial glow behind input */}
      <Animated.View
        style={[styles.ambientGlow, sGlow]}
        pointerEvents="none"
      />

      <OBProgressBar current={2} total={7} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
          <Animated.View style={[styles.header, sHeading]}>
            <Text style={styles.eyebrow}>CHAPTER III</Text>
            <Text style={styles.heading}>
              What should we{'\n'}call you?
            </Text>
            <Text style={styles.sub}>
              Your ancestor will speak to you by name.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.inputBlock, sCard]}>
            <GlassCard radius={RADIUS.lg} style={styles.inputCard}>
              <TextInput
                style={styles.input}
                placeholder="Your first name"
                placeholderTextColor={TEXT.dim}
                value={firstName}
                onChangeText={setFirstName}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
              />
              <Animated.View style={[styles.underline, sUnderline]} />
            </GlassCard>

            <View style={styles.cardGlow} pointerEvents="none" />

            <Animated.Text style={[styles.preview, sPreview]}>
              {firstName || 'You'}, your ancestor is waiting.
            </Animated.Text>
          </Animated.View>

          <OBPrimaryButton
            label={"That's me  →"}
            disabled={firstName.trim().length < 2}
            onPress={() => navigation.navigate(ROUTES.ONBOARDING.OB07_PROMISE)}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const GLOW_SIZE = SCREEN_WIDTH * 0.9;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG.warm,
  },
  ambientGlow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: GOLD.subtle,
    top: '22%',
    left: (SCREEN_WIDTH - GLOW_SIZE) / 2,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: SPACING.xl,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
  },
  eyebrow: {
    ...TYPE.uiTiny,
    color: GOLD.text,
    letterSpacing: 2.4,
    marginBottom: SPACING.md,
  },
  heading: {
    ...TYPE.displayLarge,
    fontSize: 30,
    lineHeight: 40,
    textAlign: 'center',
  },
  sub: {
    ...TYPE.uiSmall,
    color: TEXT.secondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  inputBlock: {
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  inputCard: {
    width: '92%',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  input: {
    fontFamily: DISPLAY_FONTS.regular,
    fontSize: 26,
    lineHeight: 32,
    color: TEXT.primary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
    width: '100%',
    backgroundColor: 'transparent',
  },
  underline: {
    height: 1.5,
    width: '60%',
    backgroundColor: GOLD.primary,
    borderRadius: 1,
    marginTop: SPACING.md,
  },
  cardGlow: {
    position: 'absolute',
    bottom: 40,
    height: 30,
    width: '70%',
    borderRadius: 20,
    backgroundColor: GOLD.glow,
    opacity: 0.5,
    zIndex: -1,
  },
  preview: {
    ...TYPE.displayItalic,
    color: TEXT.secondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
});

export default OB06_Name;
