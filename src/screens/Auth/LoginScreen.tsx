import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { AppAlert as Alert } from '../../shared/ui/appAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AmberButton from '../../components/onboarding/AmberButton';
import AuthButton from '../../components/onboarding/AuthButton';
import AuthLiquidBackground from '../../components/onboarding/AuthLiquidBackground';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import { login } from '../../utils/api/auth';
import { googleSignIn } from '../../utils/api/auth/GoogleAuth';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { COLORS } from '../../core/constants/theme';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  headingText?: string;
  subheadingText?: string;
  visualSubject?: string;
  visualContext?: string;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
}

const scrollContentStyle = {
  flexGrow: 1,
  justifyContent: 'center' as const,
  paddingHorizontal: 32,
};

/**
 * Standalone Login screen for returning users.
 * Shown when a user has completed onboarding but is not authenticated.
 * Skips the entire onboarding flow and goes directly to the main app on success.
 */
const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  headingText,
  subheadingText,
  visualSubject,
  visualContext,
  secondaryActionLabel,
  onSecondaryActionPress,
}) => {
  const { t } = useTranslation();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    const result = await googleSignIn();
    setGoogleLoading(false);

    if (result.success) {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
      onLoginSuccess();
    } else if (result.error.statusCode !== 0) {
      Alert.alert(t('auth.googleSignInFailedTitle'), result.error.message);
    }
  };

  const handleAppleAuth = () => {
    Alert.alert(t('auth.comingSoonTitle'), t('auth.appleComingSoonBody'));
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        t('auth.missingFieldsTitle'),
        t('auth.missingFieldsLoginBody'),
      );
      return;
    }

    setLoading(true);
    const result = await login({ email: email.trim(), password });
    setLoading(false);

    if (result.success) {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
      onLoginSuccess();
    } else {
      Alert.alert(t('auth.loginFailedTitle'), result.error.message);
    }
  };

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
          {visualSubject ? (
            <View className="mb-8">
              <OnboardingResolvedVisual
                subject={visualSubject}
                context={visualContext || 'login screen heritage context'}
                height={170}
              />
            </View>
          ) : null}

          <View className="mb-12 items-center">
            <View
              className="w-[76px] h-[76px] rounded-full items-center justify-center mb-6"
              style={{
                borderWidth: 1,
                borderColor: 'rgba(203,168,98,0.35)',
                backgroundColor: 'rgba(203,168,98,0.06)',
              }}
            >
              <Image
                source={require('../../assets/images/logo-white.png')}
                className="w-10 h-10"
                resizeMode="contain"
              />
            </View>
            <Text className="font-display text-[26px] leading-[30px] text-parchment">
              EpochEye
            </Text>
            <Text className="mt-3 font-display text-[20px] leading-[26px] text-center text-brand-gold">
              {headingText ?? t('auth.welcomeBack')}
            </Text>
            <Text className="mt-2 text-center font-ui text-sm leading-5 text-parchment-muted px-2">
              {subheadingText ?? t('auth.loginSubheading')}
            </Text>
          </View>

          {!showEmailForm ? (
            <View className="gap-5">
              {/* Google on Android, Apple on iOS (Apple sign-in is iOS-only). */}
              {Platform.OS === 'android' ? (
                <AuthButton
                  title={
                    googleLoading
                      ? t('auth.signingIn')
                      : t('auth.continueWithGoogle')
                  }
                  variant="google"
                  onPress={handleGoogleAuth}
                  disabled={googleLoading}
                />
              ) : null}
              {Platform.OS === 'ios' ? (
                <AuthButton
                  title={t('auth.continueWithApple')}
                  variant="apple"
                  onPress={handleAppleAuth}
                />
              ) : null}
              <AuthButton
                title={t('auth.continueWithEmail')}
                variant="email"
                onPress={() => setShowEmailForm(true)}
              />
            </View>
          ) : (
            <View className="gap-5">
              <TextInput
                className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-ui text-base text-parchment"
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={COLORS.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                className="h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-ui text-base text-parchment"
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
                    {t('auth.signingIn')}
                  </Text>
                </View>
              ) : (
                <AmberButton title={t('auth.signIn')} onPress={handleSubmit} />
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
          )}

          {secondaryActionLabel && onSecondaryActionPress ? (
            <TouchableOpacity
              onPress={onSecondaryActionPress}
              className="mt-8 items-center"
            >
              <Text className="font-ui text-sm text-parchment-faint">
                {secondaryActionLabel}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text className="mb-8 mt-10 text-center font-ui text-xs text-parchment-dim">
            {t('auth.termsNotice')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLiquidBackground>
  );
};

export default LoginScreen;
