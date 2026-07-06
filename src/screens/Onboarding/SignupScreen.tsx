import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  StatusBar,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
// Edge-to-edge-aware KAV (core one hides inputs behind the keyboard).
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { AppAlert as Alert } from '../../shared/ui/appAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthButton from '../../components/onboarding/AuthButton';
import AmberButton from '../../components/onboarding/AmberButton';
import AuthLiquidBackground from '../../components/onboarding/AuthLiquidBackground';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import { login, signup } from '../../utils/api/auth';
import { googleSignIn } from '../../utils/api/auth/GoogleAuth';
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
  const { t } = useTranslation();
  const fromOnboarding = route.params?.fromOnboarding ?? false;
  const storeFirstName = useOnboardingStore(s => s.firstName);
  const storeRegion = useOnboardingStore(s => s.region);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (fromOnboarding) {
      track('onboarding_signup_shown');
    }
  }, [fromOnboarding]);

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    const result = await googleSignIn();
    setGoogleLoading(false);

    if (result.success) {
      if (fromOnboarding) {
        track('onboarding_google_signup');
        navigation.navigate('OB11_Notifications');
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
        navigation.navigate('OB11_Notifications');
      }
    } else if (result.error.statusCode !== 0) {
      Alert.alert(t('auth.googleSignInFailedTitle'), result.error.message);
    }
  };

  const handleAppleAuth = () => {
    Alert.alert(t('auth.comingSoonTitle'), t('auth.appleComingSoonBody'));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert(
        t('auth.missingFieldsTitle'),
        t('auth.missingFieldsSignupBody'),
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
      Alert.alert(t('auth.signupFailedTitle'), signupResult.error.message);
      return;
    }

    const loginResult = await login({ email: email.trim(), password });
    setLoading(false);

    // The account exists now, but if the auto-login failed we have NO tokens.
    // Continuing into onboarding would drop the user into the authenticated
    // "main" state signed-out (every API call 401s). Send them to the login
    // screen to sign in with the credentials they just created instead.
    if (!loginResult.success) {
      Alert.alert(t('auth.accountCreatedTitle'), t('auth.accountCreatedBody'));
      navigation.navigate('OB10_Login');
      return;
    }

    if (!fromOnboarding) {
      // Legacy path also completes onboarding once authenticated.
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
    }
    navigation.navigate('OB11_Notifications');
  };

  // Heading text
  const headingText = fromOnboarding
    ? t('auth.saveStory', { name: storeFirstName || t('auth.defaultName') })
    : t('auth.createAccount');
  const visualSubject = storeRegion
    ? `${storeRegion.replace(/_/g, ' ')} heritage monument`
    : 'Heritage monument and ancestry story';

  const renderInitial = () => (
    <View className="gap-5">
      {/* Google on Android, Apple on iOS (Apple sign-in is iOS-only). */}
      {Platform.OS === 'android' ? (
        <AuthButton
          title={
            googleLoading ? t('auth.signingIn') : t('auth.signUpWithGoogle')
          }
          variant="google"
          onPress={handleGoogleAuth}
          disabled={googleLoading}
        />
      ) : null}
      {Platform.OS === 'ios' ? (
        <AuthButton
          title={t('auth.signUpWithApple')}
          variant="apple"
          onPress={handleAppleAuth}
        />
      ) : null}
      <AuthButton
        title={t('auth.signUpWithEmail')}
        variant="email"
        onPress={() => setShowEmailForm(true)}
      />
    </View>
  );

  const renderForm = () => (
    <View className="gap-5">
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)]  px-6 font-ui text-lg text-[#F5E9D8]"
        placeholder={t('auth.namePlaceholder')}
        placeholderTextColor={COLORS.textTertiary}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)]  px-6 font-ui text-lg text-[#F5E9D8]"
        placeholder={t('auth.emailPlaceholder')}
        placeholderTextColor={COLORS.textTertiary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)]  px-6 font-ui text-lg text-[#F5E9D8]"
        placeholder={t('auth.passwordPlaceholder')}
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
          <Text className="font-ui text-sm text-parchment-muted">
            {t('auth.creatingAccount')}
          </Text>
        </View>
      ) : (
        <AmberButton
          title={t('auth.createAccountButton')}
          onPress={handleSubmit}
        />
      )}

      <TouchableOpacity
        onPress={() => setShowEmailForm(false)}
        className="mt-2 items-center"
      >
        <Text className="font-ui-medium text-sm text-parchment-faint">
          {t('auth.backToOptions')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <AuthLiquidBackground>
      <KeyboardAvoidingView className="flex-1" behavior="padding">
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
            <Text className="font-ui text-[18px] text-parchment-muted">
              {headingText}
            </Text>
            {fromOnboarding && (
              <Text className="mt-2 font-ui text-sm text-[#8C93A0]">
                {t('auth.signupHelper')}
              </Text>
            )}
          </View>

          {!showEmailForm ? renderInitial() : renderForm()}

          {fromOnboarding && (
            <TouchableOpacity
              onPress={() => navigation.navigate('OB10_Login')}
              className="mt-8 items-center"
            >
              <Text className="font-ui text-sm text-parchment-faint">
                {t('auth.alreadyHaveAccount')}{' '}
                <Text className="font-ui-semibold text-brand-amber">
                  {t('auth.logIn')}
                </Text>
              </Text>
            </TouchableOpacity>
          )}

          {fromOnboarding && (
            <Text className="mt-4 text-center font-ui text-[11px] text-[#8C93A0]">
              {t('auth.signupReassurance')}
            </Text>
          )}

          <Text className="mb-8 mt-10 text-center font-ui text-xs text-parchment-dim">
            {t('auth.termsNotice')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLiquidBackground>
  );
};

export default SignupScreen;
