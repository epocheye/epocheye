import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import { Input, Button } from '../../components/ui';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react-native';

interface Props {
  navigation: NavigationProp<any>;
}

const ForgotPassword: React.FC<Props> = ({ navigation }) => {
  const [resetMethod, setResetMethod] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex =
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
  };

  const validateForm = (): boolean => {
    if (!identifier.trim()) {
      setError(
        `${resetMethod === 'email' ? 'Email' : 'Phone number'} is required`,
      );
      return false;
    }

    if (resetMethod === 'email' && !validateEmail(identifier)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (resetMethod === 'phone' && !validatePhone(identifier)) {
      setError('Please enter a valid phone number');
      return false;
    }

    setError('');
    return true;
  };

  const handleSendReset = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setResetSent(true);
    }, 2000);
  };

  const handleResend = () => {
    setResetSent(false);
    setIdentifier('');
    setError('');
  };

  if (resetSent) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Success Icon */}
          <View style={styles.successContainer}>
            <CheckCircle2 size={80} color={Colors.success} />
          </View>

          {/* Success Message */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Check Your {resetMethod === 'email' ? 'Email' : 'Phone'}
            </Text>
            <Text style={styles.subtitle}>
              We've sent password reset instructions to:
            </Text>
            <Text style={styles.identifierText}>{identifier}</Text>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionTitle}>Next Steps:</Text>
            <Text style={styles.instructionText}>
              1. Check your{' '}
              {resetMethod === 'email' ? 'email inbox' : 'phone messages'}
            </Text>
            <Text style={styles.instructionText}>
              2. Click the reset link or enter the code
            </Text>
            <Text style={styles.instructionText}>3. Create a new password</Text>
            {resetMethod === 'email' && (
              <Text style={styles.instructionText}>
                4. Check your spam folder if you don't see it
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <Button
              title="Back to Login"
              onPress={() => navigation.navigate('Login')}
              fullWidth
              style={styles.backButton}
            />

            <Button
              title="Resend Instructions"
              onPress={handleResend}
              variant="outline"
              fullWidth
            />
          </View>

          {/* Support Link */}
          <View style={styles.supportContainer}>
            <Text style={styles.supportText}>
              Didn't receive the instructions?{' '}
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  'Support',
                  'Contact support at support@epocheye.app',
                )
              }
            >
              <Text style={styles.supportLink}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButtonContainer}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={Colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Don't worry! Enter your{' '}
              {resetMethod === 'email' ? 'email address' : 'phone number'} and
              we'll send you instructions to reset your password.
            </Text>
          </View>

          {/* Reset Method Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                resetMethod === 'email' && styles.toggleButtonActive,
              ]}
              onPress={() => {
                setResetMethod('email');
                setIdentifier('');
                setError('');
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: resetMethod === 'email' }}
            >
              <Text
                style={[
                  styles.toggleText,
                  resetMethod === 'email' && styles.toggleTextActive,
                ]}
              >
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                resetMethod === 'phone' && styles.toggleButtonActive,
              ]}
              onPress={() => {
                setResetMethod('phone');
                setIdentifier('');
                setError('');
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: resetMethod === 'phone' }}
            >
              <Text
                style={[
                  styles.toggleText,
                  resetMethod === 'phone' && styles.toggleTextActive,
                ]}
              >
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label={resetMethod === 'email' ? 'Email Address' : 'Phone Number'}
              placeholder={
                resetMethod === 'email'
                  ? 'Enter your email'
                  : 'Enter your phone number'
              }
              value={identifier}
              onChangeText={text => {
                setIdentifier(text);
                if (error) {
                  setError('');
                }
              }}
              error={error}
              leftIcon={<Mail size={20} color={Colors.textSecondary} />}
              keyboardType={
                resetMethod === 'phone' ? 'phone-pad' : 'email-address'
              }
              autoCapitalize="none"
            />

            <Button
              title="Send Reset Instructions"
              onPress={handleSendReset}
              loading={loading}
              fullWidth
              style={styles.sendButton}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  title: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
  },
  identifierText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: 50,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: 50,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text,
  },
  toggleTextActive: {
    color: Colors.background,
  },
  form: {
    marginBottom: Spacing.xl,
  },
  sendButton: {
    marginTop: Spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.secondary,
  },
  successContainer: {
    alignItems: 'center',
    marginVertical: Spacing['2xl'],
  },
  instructionsContainer: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  instructionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  instructionText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
  },
  actionContainer: {
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  backButton: {
    marginBottom: Spacing.sm,
  },
  supportContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  supportText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  supportLink: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.secondary,
  },
});
