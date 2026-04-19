import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {ROUTES} from '../../core/constants/routes';
import {BG} from '../../constants/onboarding';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB03_Frequency'>;

/**
 * Combined into OB02 "About You". This route stays in the navigator for
 * backward compatibility and immediately forwards to OB05.
 */
const OB03_Frequency: React.FC<Props> = ({navigation}) => {
  useEffect(() => {
    navigation.replace(ROUTES.ONBOARDING.OB05_REGION);
  }, [navigation]);

  return <View style={styles.container} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG.deep,
  },
});

export default OB03_Frequency;
