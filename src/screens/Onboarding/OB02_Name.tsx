import React, {useCallback, useEffect, useState} from 'react';
import {
  Pressable,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
// Edge-to-edge-aware KAV; the core one was a no-op on Android here
// (behavior undefined) so the Continue button hid behind the keyboard.
import {KeyboardAvoidingView} from 'react-native-keyboard-controller';
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
    <View className="flex-1 bg-ink-warm">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View
          className="flex-1 px-[28px]"
          style={{paddingTop: insets.top + 80}}>
          <Animated.Text
            className="font-handwritten text-[44px] text-parchment leading-[52px]"
            style={sTitle}>
            Welcoome to
          </Animated.Text>
          <Animated.Text
            className="font-handwritten text-[56px] text-brand-lime leading-[64px] -mt-1"
            style={sTitle}>
            Epocheye
          </Animated.Text>

          <Animated.Text
            className="font-serif-italic text-[22px] text-[rgba(255,255,255,0.78)] leading-[30px] mt-9"
            style={sSub}>
            Before we go further -{'\n'}What should we call you?
          </Animated.Text>

          <Animated.View className="mt-11" style={sInput}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="text-[22px] text-parchment py-2.5 px-0"
              style={{fontFamily: FONTS.medium}}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onContinue}
              maxLength={40}
            />
            <View className="h-px bg-[rgba(255,255,255,0.35)]" />
          </Animated.View>
        </View>

        <View
          className="px-[28px]"
          style={{paddingBottom: insets.bottom + 20}}>
          <Pressable
            onPress={onContinue}
            disabled={!canContinue}
            className="w-full h-14 rounded-full bg-brand-sky items-center justify-center"
            style={({pressed}) =>
              pressed && canContinue
                ? {transform: [{scale: 0.98}], backgroundColor: COLORS.skyDark}
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel="Continue">
            <Text className="font-ui-medium text-[17px] text-parchment tracking-[0.3px]">
              Continue
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default OB02_Name;
