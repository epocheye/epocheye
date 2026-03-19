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
import AuthButton from '../../components/onboarding/AuthButton';
import AmberButton from '../../components/onboarding/AmberButton';
import { login, signup } from '../../utils/api/auth';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import {
  FONTS,
  COLORS,
  FONT_SIZES,
  SPACING,
  RADIUS,
} from '../../core/constants/theme';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'Signup'>;
type AuthMode = 'initial' | 'login' | 'register';

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
        onPress={() => setMode('login')}
      />
    </View>
  );

  const renderForm = () => (
    <View style={styles.form}>
      {mode === 'register' && (
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={COLORS.textTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
        />
      )}
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
          <Text style={styles.loadingText}>
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
        style={styles.switchButton}
      >
        <Text style={styles.switchText}>
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </View>
  );

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
        <View style={styles.headerSection}>
          <Text style={styles.headline}>
            {mode === 'register' ? 'Create your account.' : 'Welcome back.'}
          </Text>
          {mode === 'initial' && (
            <Text style={styles.subheader}>
              Save your story. Keep exploring.
            </Text>
          )}
        </View>

        {mode === 'initial' ? renderInitial() : renderForm()}

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
  headerSection: {
    marginBottom: SPACING.section,
  },
  headline: {
    fontFamily: FONTS.bold,
    fontSize: FONT_SIZES.hero,
    color: COLORS.textPrimary,
    lineHeight: 44,
    marginBottom: SPACING.sm,
  },
  subheader: {
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
  switchButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  switchText: {
    fontFamily: FONTS.medium,
    fontSize: FONT_SIZES.small,
    color: COLORS.amber,
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

export default SignupScreen;
