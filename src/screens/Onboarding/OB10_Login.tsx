import React from 'react';
import LoginScreen from '../Auth/LoginScreen';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB10_Login'>;

const OB10_Login: React.FC<Props> = ({ navigation }) => {
  return (
    <LoginScreen
      onLoginSuccess={() => navigation.navigate('OB11_Notifications')}
      headingText="Welcome back"
      subheadingText="Sign in to continue your ancestor journey."
      secondaryActionLabel="Need an account? Create one"
      onSecondaryActionPress={() =>
        navigation.navigate('OB10_SignUp', { fromOnboarding: true })
      }
    />
  );
};

export default OB10_Login;
