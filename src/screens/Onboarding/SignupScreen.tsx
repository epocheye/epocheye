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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthButton from '../../components/onboarding/AuthButton';
import AmberButton from '../../components/onboarding/AmberButton';
import { login, signup } from '../../utils/api/auth';
import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'Signup'>;

type AuthMode = 'initial' | 'login' | 'register';

/**
 * Screen 6 — Signup/Login screen.
 * Cleanest screen in the flow. No textures, no animations.
 * Three auth options: Google, Apple, Email. Google/Apple coming soon.
 * Email opens inline form with login/register toggle.
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

  const handleEmailAuth = () => {
    setMode('login');
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
        navigation.navigate(ROUTES.ONBOARDING.PERMISSIONS);
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
        // After signup, log them in automatically
        const loginResult = await login({ email: email.trim(), password });
        if (loginResult.success) {
          await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
          navigation.navigate(ROUTES.ONBOARDING.PERMISSIONS);
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
        onPress={handleEmailAuth}
      />
    </View>
  );

  const renderForm = () => (
    <View style={styles.form}>
      {mode === 'register' && (
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#D4860A" size="small" />
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

      <Text
        style={styles.switchText}
        onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login'
          ? "Don't have an account? Sign up"
          : 'Already have an account? Sign in'}
      </Text>
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
        <Text style={styles.header}>Save your story.{'\n'}Keep exploring.</Text>

        <View style={styles.spacer} />

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
    backgroundColor: '#1A1612',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    fontFamily: 'CormorantGaramond-SemiBold',
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 48,
  },
  spacer: {
    height: 40,
  },
  authButtons: {
    gap: 16,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  loadingContainer: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  switchText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    color: '#D4860A',
    textAlign: 'center',
    marginTop: 8,
  },
  footnote: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
});

export default SignupScreen;
