import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AmberButton from '../../components/onboarding/AmberButton';
import AuthButton from '../../components/onboarding/AuthButton';
import { login } from '../../utils/api/auth';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import {
  FONTS,
  COLORS,
  FONT_SIZES,
  SPACING,
  RADIUS,
} from '../../core/constants/theme';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <Text style={styles.appName}>EpochEye</Text>
          <Text style={styles.tagline}>Welcome back</Text>
        </View>

        {!showEmailForm ? (
          <View style={styles.authButtons}>
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
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.amber} size="small" />
                <Text style={styles.loadingText}>Signing in...</Text>
              </View>
            ) : (
              <AmberButton title="Sign In" onPress={handleSubmit} />
            )}

            <TouchableOpacity
              onPress={() => setShowEmailForm(false)}
              style={styles.backButton}
            >
              <Text style={styles.backText}>Back to options</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footnote}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgWarm,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.screen,
  },
  appName: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.hero,
    color: COLORS.amber,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.subtitle,
    color: COLORS.textSecondary,
  },
  authButtons: {
    gap: SPACING.lg,
  },
  form: {
    gap: SPACING.lg,
  },
  input: {
    height: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: SPACING.xl,
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.button,
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.small,
    color: COLORS.textSecondary,
  },
  backButton: {
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  backText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.textTertiary,
  },
  footnote: {
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.section,
    marginBottom: SPACING.xxl,
  },
});

export default LoginScreen;
