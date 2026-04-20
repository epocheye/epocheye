import React from 'react';
import LoginScreen from '../Auth/LoginScreen';
import { useOnboardingStore } from '../../stores/onboardingStore';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB10_Login'>;

const OB10_Login: React.FC<Props> = ({ navigation }) => {
  const firstName = useOnboardingStore(state => state.firstName);
  const region = useOnboardingStore(state => state.region);
  const visualSubject = region
    ? `${region.replace(/_/g, ' ')} ancestry and heritage site`
    : `${firstName || 'Explorer'} ancestry story`;

  return (
    <LoginScreen
      onLoginSuccess={() => navigation.navigate('OB11_Notifications')}
      headingText="Welcome back"
      subheadingText="Sign in to continue your ancestor journey."
      visualSubject={visualSubject}
      visualContext="onboarding login continuity"
      secondaryActionLabel="Need an account? Create one"
      onSecondaryActionPress={() =>
        navigation.navigate('OB10_SignUp', { fromOnboarding: true })
      }
    />
  );
};

export default OB10_Login;
