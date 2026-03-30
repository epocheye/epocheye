import React from 'react';
import {View, Text, StyleSheet, StatusBar} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Landmark, Globe, TreePine, BookOpen} from 'lucide-react-native';
import {OB_COLORS, OB_TYPOGRAPHY} from '../../constants/onboarding';
import {useOnboardingStore} from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import {track} from '../../services/analytics';
import type {OnboardingScreenProps} from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB02_Motivation'>;

const OPTIONS = [
  {id: 'heritage_visitor', label: 'I visit heritage sites', Icon: Landmark},
  {id: 'traveller', label: 'I love to travel', Icon: Globe},
  {id: 'roots', label: 'I want to know my roots', Icon: TreePine},
  {id: 'history_lover', label: 'I love history', Icon: BookOpen},
] as const;

const OB02_Motivation: React.FC<Props> = ({navigation}) => {
  const motivation = useOnboardingStore((s) => s.motivation);
  const setMotivation = useOnboardingStore((s) => s.setMotivation);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={1} total={10} />

      <View style={[styles.content, {paddingBottom: insets.bottom + 24}]}>
        <View style={styles.header}>
          <Text style={[OB_TYPOGRAPHY.heading, styles.heading]}>
            What brings you here?
          </Text>
          <Text style={OB_TYPOGRAPHY.sub}>
            We'll personalise your experience.
          </Text>
        </View>

        <View style={styles.grid}>
          {OPTIONS.map((opt) => (
            <OBSelectionTile
              key={opt.id}
              icon={
                <opt.Icon
                  size={24}
                  color={motivation === opt.id ? '#E8A020' : '#8C93A0'}
                />
              }
              label={opt.label}
              selected={motivation === opt.id}
              onPress={() => setMotivation(opt.id)}
              layout="grid"
            />
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <OBPrimaryButton
            label="Continue →"
            disabled={!motivation}
            onPress={() => {
              track('onboarding_motivation_set', {motivation});
              navigation.navigate('OB03_Frequency');
            }}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB_COLORS.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 24,
    marginTop: 40,
  },
  heading: {
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  ctaWrap: {
    marginTop: 24,
  },
});

export default OB02_Motivation;
