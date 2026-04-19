import React, {useEffect} from 'react';
import {View, StyleSheet} from 'react-native';
import {ROUTES} from '../../core/constants/routes';
import {BG} from '../../constants/onboarding';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB08_DemoStory'>;

/**
 * Merged into OB07 "The Connection" (3-state promise → loading → story).
 * This route stays in the navigator for backward compatibility and
 * forwards straight to OB09.
 */
const OB08_DemoStory: React.FC<Props> = ({navigation}) => {
  useEffect(() => {
    navigation.replace(ROUTES.ONBOARDING.OB09_REACTION);
  }, [navigation]);

  return <View style={styles.container} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG.deep,
  },
});

export default OB08_DemoStory;
