import React, {useCallback, useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {COLORS, FONTS} from '../../core/constants/theme';
import {ROUTES} from '../../core/constants/routes';
import {useOnboardingStore} from '../../stores/onboardingStore';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB02_Name'>;

const OB02_Name: React.FC<Props> = ({navigation}) => {
  const insets = useSafeAreaInsets();
  const storedName = useOnboardingStore(s => s.firstName);
  const setFirstName = useOnboardingStore(s => s.setFirstName);

  const [value, setValue] = useState(storedName ?? '');

  const titleO = useSharedValue(0);
  const titleY = useSharedValue(14);
  const subO = useSharedValue(0);
  const inputO = useSharedValue(0);

  useEffect(() => {
    titleO.value = withDelay(200, withTiming(1, {duration: 600}));
    titleY.value = withDelay(
      200,
      withTiming(0, {duration: 600, easing: Easing.out(Easing.cubic)}),
    );
    subO.value = withDelay(600, withTiming(1, {duration: 500}));
    inputO.value = withDelay(900, withTiming(1, {duration: 500}));
  }, [titleO, titleY, subO, inputO]);

  const sTitle = useAnimatedStyle(() => ({
    opacity: titleO.value,
    transform: [{translateY: titleY.value}],
  }));
  const sSub = useAnimatedStyle(() => ({opacity: subO.value}));
  const sInput = useAnimatedStyle(() => ({opacity: inputO.value}));

  const trimmed = value.trim();
  const canContinue = trimmed.length >= 2;

  const onContinue = useCallback(() => {
    if (!canContinue) return;
    setFirstName(trimmed);
    navigation.navigate(ROUTES.ONBOARDING.OB03_REGION);
  }, [canContinue, trimmed, setFirstName, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}>
        <View style={[styles.content, {paddingTop: insets.top + 80}]}>
          <Animated.Text style={[styles.titleLine1, sTitle]}>
            Welcoome to
          </Animated.Text>
          <Animated.Text style={[styles.titleLine2, sTitle]}>
            Epocheye
          </Animated.Text>

          <Animated.Text style={[styles.sub, sSub]}>
            Before we go further -{'\n'}What should we call you?
          </Animated.Text>

          <Animated.View style={[styles.inputWrap, sInput]}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onContinue}
              maxLength={40}
            />
            <View style={styles.underline} />
          </Animated.View>
        </View>

        <View style={[styles.footer, {paddingBottom: insets.bottom + 20}]}>
          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            style={({pressed}) => [
              styles.cta,
              !canContinue && styles.ctaDisabled,
              pressed && canContinue && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue">
            <Text style={styles.ctaLabel}>Continue</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  kav: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  titleLine1: {
    fontFamily: FONTS.handwritten,
    fontSize: 44,
    color: '#FFFFFF',
    lineHeight: 52,
  },
  titleLine2: {
    fontFamily: FONTS.handwritten,
    fontSize: 56,
    color: COLORS.lime,
    lineHeight: 64,
    marginTop: -4,
  },
  sub: {
    fontFamily: FONTS.serifItalic,
    fontSize: 22,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 30,
    marginTop: 36,
  },
  inputWrap: {
    marginTop: 44,
  },
  input: {
    fontFamily: FONTS.medium,
    fontSize: 22,
    color: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  underline: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  footer: {
    paddingHorizontal: 28,
  },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: COLORS.skyDark,
    transform: [{scale: 0.98}],
  },
  ctaDisabled: {
    backgroundColor: 'rgba(97,166,211,0.35)',
  },
  ctaLabel: {
    fontFamily: FONTS.medium,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default OB02_Name;
