import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OB_COLORS, OB_TYPOGRAPHY } from '../../constants/onboarding';
import { FONTS } from '../../core/constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB06_Name'>;

const OB06_Name: React.FC<Props> = ({ navigation }) => {
  const firstName = useOnboardingStore(s => s.firstName);
  const setFirstName = useOnboardingStore(s => s.setFirstName);
  const insets = useSafeAreaInsets();
  const subject = firstName.trim().length
    ? `${firstName} ancestor portrait and monument`
    : 'Ancestral storyteller and monument silhouette';

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.header}>
            <Text style={OB_TYPOGRAPHY.heading}>What should we call you?</Text>
            <Text style={[OB_TYPOGRAPHY.sub, styles.sub]}>
              Your ancestor will speak to you by name.
            </Text>
          </View>

          <View style={styles.visualWrap}>
            <OnboardingResolvedVisual
              subject={subject}
              context="onboarding first name personalization"
              height={150}
            />
          </View>

          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Your first name"
              placeholderTextColor="#8C93A0"
              value={firstName}
              onChangeText={setFirstName}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />

            {firstName.length > 0 && (
              <Text style={styles.preview}>
                Your ancestor is waiting, {firstName}.
              </Text>
            )}
          </View>

          <View style={styles.ctaWrap}>
            <OBPrimaryButton
              label="That's me →"
              disabled={firstName.trim().length < 2}
              onPress={() => navigation.navigate('OB07_Promise')}
            />
          </View>
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
    paddingHorizontal: 24,
    marginTop: 40,
  },
  sub: {
    marginTop: 8,
  },
  visualWrap: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  inputArea: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  input: {
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    borderBottomWidth: 1.5,
    borderColor: '#E8A020',
    paddingVertical: 12,
    width: '80%',
    fontFamily: FONTS.medium,
    backgroundColor: 'transparent',
  },
  preview: {
    color: '#8C93A0',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
    fontFamily: FONTS.italic,
  },
  ctaWrap: {
    marginTop: 24,
  },
});

export default OB06_Name;
