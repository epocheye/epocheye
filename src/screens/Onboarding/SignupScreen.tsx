import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthButton from '../../components/onboarding/AuthButton';
import AmberButton from '../../components/onboarding/AmberButton';
import AuthLiquidBackground from '../../components/onboarding/AuthLiquidBackground';
import { login, signup } from '../../utils/api/auth';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { COLORS } from '../../core/constants/theme';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'Signup'>;
type AuthMode = 'initial' | 'login' | 'register';

const scrollContentStyle = {
  flexGrow: 1,
  justifyContent: 'center' as const,
  paddingHorizontal: 32,
};

/**
 * Screen 5 — Signup/Login screen.
 * Three auth options: Google, Apple, Email. Google/Apple alerts "Coming Soon".
 * Email opens an inline form with a login/register toggle.
 * On success, stores onboarding complete flag and navigates to Welcome.
 */
const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [mode, setMode] = useState<AuthMode>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = () => {
    Alert.alert('Coming Soon', 'Google sign-in will be available soon.');
  };

  const handleAppleAuth = () => {
    Alert.alert('Coming Soon', 'Apple sign-in will be available soon.');
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      Alert.alert('Missing fields', 'Please enter your name.');
      return;
    }

    setLoading(true);

    if (mode === 'login') {
      const result = await login({ email: email.trim(), password });
      setLoading(false);

      if (result.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
        navigation.navigate(ROUTES.ONBOARDING.WELCOME);
      } else {
        Alert.alert('Login failed', result.error.message);
      }
    } else {
      const result = await signup({
        email: email.trim(),
        name: name.trim(),
        password,
      });
      setLoading(false);

      if (result.success) {
        const loginResult = await login({ email: email.trim(), password });
        if (loginResult.success) {
          await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
          navigation.navigate(ROUTES.ONBOARDING.WELCOME);
        } else {
          Alert.alert(
            'Account created',
            'Please log in with your new credentials.',
          );
          setMode('login');
        }
      } else {
        Alert.alert('Signup failed', result.error.message);
      }
    }
  };

  const renderInitial = () => (
    <View className="gap-5">
      <AuthButton
        title="Continue with Google"
        variant="google"
        onPress={handleGoogleAuth}
      />
      <AuthButton
        title="Continue with Apple"
        variant="apple"
        onPress={handleAppleAuth}
      />
      <AuthButton
        title="Continue with Email"
        variant="email"
        onPress={() => setMode('login')}
      />
    </View>
  );

  const renderForm = () => (
    <View className="gap-5">
      {mode === 'register' && (
        <TextInput
          className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)] bg-[#241D16] px-6 font-['MontserratAlternates-Regular'] text-lg text-[#F5E9D8]"
          placeholder="Your name"
          placeholderTextColor={COLORS.textTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
        />
      )}
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)] bg-[#241D16] px-6 font-['MontserratAlternates-Regular'] text-lg text-[#F5E9D8]"
        placeholder="Email"
        placeholderTextColor={COLORS.textTertiary}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        className="h-14 rounded-xl border border-[rgba(255,255,255,0.2)] bg-[#241D16] px-6 font-['MontserratAlternates-Regular'] text-lg text-[#F5E9D8]"
        placeholder="Password"
        placeholderTextColor={COLORS.textTertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <View className="h-14 flex-row items-center justify-center gap-3">
          <ActivityIndicator color={COLORS.amber} size="small" />
          <Text className="font-['MontserratAlternates-Regular'] text-sm text-[#B8AF9E]">
            {mode === 'login' ? 'Signing in...' : 'Creating account...'}
          </Text>
        </View>
      ) : (
        <AmberButton
          title={mode === 'login' ? 'Sign In' : 'Create Account'}
          onPress={handleSubmit}
        />
      )}

      <TouchableOpacity
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="items-center py-2"
      >
        <Text className="font-['MontserratAlternates-Medium'] text-sm text-[#D4860A]">
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
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
          <View className="mb-10">
            <Text className="mb-2 font-['MontserratAlternates-Bold'] text-[36px] leading-[44px] text-[#F5E9D8]">
              {mode === 'register' ? 'Create your account.' : 'Welcome back.'}
            </Text>
            {mode === 'initial' && (
              <Text className="font-['MontserratAlternates-Regular'] text-[18px] text-[#B8AF9E]">
                Save your story. Keep exploring.
              </Text>
            )}
          </View>

          {mode === 'initial' ? renderInitial() : renderForm()}

          <Text className="mb-8 mt-10 text-center font-['MontserratAlternates-Regular'] text-xs text-[#6B6357]">
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLiquidBackground>
  );
};

export default SignupScreen;
