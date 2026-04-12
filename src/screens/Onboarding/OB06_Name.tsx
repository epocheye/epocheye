import React, {useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
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
import {OB_COLORS} from '../../constants/onboarding';
import {FONTS} from '../../core/constants/theme';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB06_Name'>;

const OB06_Name: React.FC<Props> = ({navigation}) => {
  const firstName = useOnboardingStore(s => s.firstName);
  const setFirstName = useOnboardingStore(s => s.setFirstName);
  const insets = useSafeAreaInsets();

  // Entrance animations
  const headingO = useSharedValue(0);
  const headingY = useSharedValue(16);
  const inputO = useSharedValue(0);
  const previewO = useSharedValue(0);

  // Breathing underline
  const underlineOpacity = useSharedValue(0.6);

  useEffect(() => {
    headingO.value = withTiming(1, {duration: 400});
    headingY.value = withSpring(0, {damping: 20, stiffness: 140});
    inputO.value = withTiming(1, {duration: 500});

    // Amber underline breathing
    underlineOpacity.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 1500, easing: Easing.inOut(Easing.ease)}),
        withTiming(0.5, {duration: 1500, easing: Easing.inOut(Easing.ease)}),
      ),
      -1,
      false,
    );
  }, [headingO, headingY, inputO, underlineOpacity]);

  // Preview text fades in when name has 2+ chars
  useEffect(() => {
    if (firstName.trim().length >= 2) {
      previewO.value = withTiming(1, {duration: 300});
    } else {
      previewO.value = withTiming(0, {duration: 200});
    }
  }, [firstName, previewO]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingO.value,
    transform: [{translateY: headingY.value}],
  }));
  const inputStyle = useAnimatedStyle(() => ({opacity: inputO.value}));
  const previewStyle = useAnimatedStyle(() => ({opacity: previewO.value}));
  const underlineStyle = useAnimatedStyle(() => ({
    opacity: underlineOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={5} total={10} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
          <Animated.View style={[styles.header, headingStyle]}>
            <Text style={styles.heading}>What should we{'\n'}call you?</Text>
            <Text style={styles.sub}>
              Your ancestor will speak to you by name.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.inputArea, inputStyle]}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Your first name"
                placeholderTextColor="#555"
                value={firstName}
                onChangeText={setFirstName}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
              />
              <Animated.View style={[styles.underline, underlineStyle]} />
            </View>

            <Animated.Text style={[styles.preview, previewStyle]}>
              Your ancestor is waiting, {firstName}.
            </Animated.Text>
          </Animated.View>

          <OBPrimaryButton
            label={"That's me  →"}
            disabled={firstName.trim().length < 2}
            onPress={() => navigation.navigate('OB07_Promise')}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 28,
    marginTop: 32,
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
    color: '#FFFFFF',
    fontFamily: FONTS.extraBold,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
    marginTop: 10,
    textAlign: 'center',
  },
  inputArea: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  inputWrapper: {
    width: '75%',
    alignItems: 'center',
  },
  input: {
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingVertical: 12,
    width: '100%',
    fontFamily: FONTS.medium,
    backgroundColor: 'transparent',
  },
  underline: {
    height: 2,
    width: '100%',
    backgroundColor: '#E8A020',
    borderRadius: 1,
  },
  preview: {
    color: '#8C93A0',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: FONTS.italic,
  },
});

export default OB06_Name;
