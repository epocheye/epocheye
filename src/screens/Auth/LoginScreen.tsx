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
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AmberButton from '../../components/onboarding/AmberButton';
import AuthButton from '../../components/onboarding/AuthButton';
import AuthLiquidBackground from '../../components/onboarding/AuthLiquidBackground';
import { login } from '../../utils/api/auth';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { COLORS } from '../../core/constants/theme';

interface LoginScreenProps {
  onLoginSuccess: () => void;
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
const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    setLoading(true);
    const result = await login({ email: email.trim(), password });
    setLoading(false);

    if (result.success) {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
      onLoginSuccess();
    } else {
      Alert.alert('Login failed', result.error.message);
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
          <View className="mb-16 items-center">
            <Image
              source={require('../../assets/images/logo-white.png')}
              className="size-20 my-5"
            />
            <Text className="font-['MontserratAlternates-Regular'] text-[18px] text-[#B8AF9E]">
              Welcome back
            </Text>
          </View>

          {!showEmailForm ? (
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
                onPress={() => setShowEmailForm(true)}
              />
            </View>
          ) : (
            <View className="gap-5">
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
                  <ActivityIndicator color={COLORS.amber} size="small" />
                  <Text className="font-['MontserratAlternates-Regular'] text-sm text-[#B8AF9E]">
                    Signing in...
                  </Text>
                </View>
              ) : (
                <AmberButton title="Sign In" onPress={handleSubmit} />
              )}

              <TouchableOpacity
                onPress={() => setShowEmailForm(false)}
                className="mt-2 items-center"
              >
                <Text className="font-['MontserratAlternates-Medium'] text-sm text-[#8F8576]">
                  Back to options
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text className="mb-8 mt-10 text-center font-['MontserratAlternates-Regular'] text-xs text-[#6B6357]">
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthLiquidBackground>
  );
};

export default LoginScreen;
