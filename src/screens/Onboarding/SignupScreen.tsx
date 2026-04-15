import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthButton from '../../components/onboarding/AuthButton';
import AmberButton from '../../components/onboarding/AmberButton';
import AuthLiquidBackground from '../../components/onboarding/AuthLiquidBackground';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import { login, signup } from '../../utils/api/auth';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { COLORS } from '../../core/constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { track } from '../../services/analytics';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB10_SignUp'>;

const scrollContentStyle = {
  flexGrow: 1,
  justifyContent: 'center' as const,
  paddingHorizontal: 32,
};

const SignupScreen: React.FC<Props> = ({ navigation, route }) => {
  const fromOnboarding = route.params?.fromOnboarding ?? false;
  const storeFirstName = useOnboardingStore(s => s.firstName);
  const storeDemoMonument = useOnboardingStore(s => s.demoMonument);
  const storeRegions = useOnboardingStore(s => s.regions);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fromOnboarding) {
      track('onboarding_signup_shown');
    }
  }, [fromOnboarding]);

  const handleGoogleAuth = () => {
    Alert.alert('Coming Soon', 'Google sign-in will be available soon.');
  };

  const handleAppleAuth = () => {
    Alert.alert('Coming Soon', 'Apple sign-in will be available soon.');
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert(
        'Missing fields',
        'Please enter your name, email, and password.',
      );
      return;
    }

    setLoading(true);

    const signupResult = await signup({
      email: email.trim(),
      name: name.trim(),
      password,
    });

    if (!signupResult.success) {
      setLoading(false);
      Alert.alert('Signup failed', signupResult.error.message);
      return;
    }

    const loginResult = await login({ email: email.trim(), password });
    setLoading(false);

    if (fromOnboarding) {
      // In onboarding flow: navigate to notifications screen
      navigation.navigate('OB11_Notifications');
    } else {
      // Legacy: store onboarding complete and navigate to welcome
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
      if (loginResult.success) {
        navigation.navigate('OB11_Notifications');
      } else {
        Alert.alert(
          'Account created',
          'Your account was created. Please sign in from the login screen if needed.',
        );
        navigation.navigate('OB11_Notifications');
      }
    }
  };

  // Heading text
  const headingText = fromOnboarding
    ? `Save ${storeFirstName || 'your'} story.`
    : 'Create your account';
  const visualSubject = storeDemoMonument
    ? `${storeDemoMonument} heritage monument`
    : storeRegions.length > 0
    ? `${storeRegions[0]} heritage monument`
    : 'Heritage monument and ancestry story';

  const renderInitial = () => (
    <View className="gap-5">
      <AuthButton
        title="Sign up with Google"
        variant="google"
        onPress={handleGoogleAuth}
      />
      <AuthButton
        title="Sign up with Apple"
        variant="apple"
        onPress={handleAppleAuth}
      />
      <AuthButton
        title="Sign up with Email"
        variant="email"
        onPress={() => setShowEmailForm(true)}
      />
    </View>
  );

  const renderForm = () => (
    <View className="gap-5">
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)]  px-6 font-['MontserratAlternates-Regular'] text-lg text-[#F5E9D8]"
        placeholder="Your name"
        placeholderTextColor={COLORS.textTertiary}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)]  px-6 font-['MontserratAlternates-Regular'] text-lg text-[#F5E9D8]"
        placeholder="Email"
        placeholderTextColor={COLORS.textTertiary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)]  px-6 font-['MontserratAlternates-Regular'] text-lg text-[#F5E9D8]"
        placeholder="Password"
        placeholderTextColor={COLORS.textTertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <View className="h-14 flex-row items-center justify-center gap-3">
          <AnimatedLogo
            variant="white"
            size={22}
            motion="pulse"
            showRing={false}
          />
          <Text className="font-['MontserratAlternates-Regular'] text-sm text-parchment-muted">
            Creating account...
          </Text>
        </View>
      ) : (
        <AmberButton title="Create Account" onPress={handleSubmit} />
      )}

      <TouchableOpacity
        onPress={() => setShowEmailForm(false)}
        className="mt-2 items-center"
      >
        <Text className="font-['MontserratAlternates-Medium'] text-sm text-parchment-faint">
          Back to options
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AuthLiquidBackground>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />

        <ScrollView
          contentContainerStyle={scrollContentStyle}
          keyboardShouldPersistTaps="handled"
        >
          {fromOnboarding ? (
            <View className="mb-8">
              <OnboardingResolvedVisual
                subject={visualSubject}
                context="onboarding signup emotional continuity"
                height={170}
              />
            </View>
          ) : null}

          <View className="mb-16 items-center">
            <Image
              source={require('../../assets/images/logo-white.png')}
              className="size-20 my-5"
            />
            <Text className="font-['MontserratAlternates-Regular'] text-[18px] text-parchment-muted">
              {headingText}
            </Text>
            {fromOnboarding && (
              <Text className="mt-2 font-['MontserratAlternates-Regular'] text-sm text-[#8C93A0]">
                Create a free account to keep your ancestor.
              </Text>
            )}
          </View>

          {!showEmailForm ? renderInitial() : renderForm()}

          {fromOnboarding && (
            <TouchableOpacity
              onPress={() => navigation.navigate('OB10_Login')}
              className="mt-8 items-center"
            >
              <Text className="font-['MontserratAlternates-Regular'] text-sm text-parchment-faint">
                Already have an account?{' '}
                <Text className="font-['MontserratAlternates-SemiBold'] text-brand-amber">
                  Log in
                </Text>
              </Text>
            </TouchableOpacity>
          )}

          {fromOnboarding && (
            <Text className="mt-4 text-center font-['MontserratAlternates-Regular'] text-[11px] text-[#8C93A0]">
              Takes 10 seconds. No spam. Your data is never sold.
            </Text>
          )}

          <Text className="mb-8 mt-10 text-center font-['MontserratAlternates-Regular'] text-xs text-parchment-dim">
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLiquidBackground>
  );
};

export default SignupScreen;
