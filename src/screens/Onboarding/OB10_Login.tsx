import React from 'react';
import LoginScreen from '../Auth/LoginScreen';
import { useOnboardingStore } from '../../stores/onboardingStore';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB10_Login'>;

const OB10_Login: React.FC<Props> = ({ navigation }) => {
  const firstName = useOnboardingStore(state => state.firstName);
  const demoMonument = useOnboardingStore(state => state.demoMonument);
  const regions = useOnboardingStore(state => state.regions);
  const visualSubject = demoMonument
    ? `${demoMonument} heritage monument`
    : regions.length > 0
    ? `${regions[0]} ancestry and heritage site`
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
