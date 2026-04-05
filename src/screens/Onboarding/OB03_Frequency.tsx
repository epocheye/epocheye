import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Luggage, CalendarDays, Sprout } from 'lucide-react-native';
import { OB_COLORS, OB_TYPOGRAPHY } from '../../constants/onboarding';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB03_Frequency'>;

const OPTIONS = [
  {
    id: 'frequent',
    label: 'Frequently',
    sublabel: 'I travel to heritage sites often',
    Icon: Luggage,
  },
  {
    id: 'occasional',
    label: 'Occasionally',
    sublabel: 'A few times a year',
    Icon: CalendarDays,
  },
  {
    id: 'rarely',
    label: 'Rarely',
    sublabel: 'But I want to start',
    Icon: Sprout,
  },
] as const;

const FREQUENCY_SUBJECTS: Record<(typeof OPTIONS)[number]['id'], string> = {
  frequent: 'Frequent heritage site explorer',
  occasional: 'Seasonal cultural travel itinerary',
  rarely: 'First-time monument visitor inspiration',
};

const OB03_Frequency: React.FC<Props> = ({ navigation }) => {
  const visitFrequency = useOnboardingStore(s => s.visitFrequency);
  const setVisitFrequency = useOnboardingStore(s => s.setVisitFrequency);
  const insets = useSafeAreaInsets();
  const subject = visitFrequency
    ? FREQUENCY_SUBJECTS[visitFrequency]
    : 'People exploring monuments across time';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={2} total={10} />

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={OB_TYPOGRAPHY.heading}>
            How often do you explore history?
          </Text>
        </View>

        <View style={styles.visualWrap}>
          <OnboardingResolvedVisual
            subject={subject}
            context="onboarding frequency selection"
            height={150}
          />
        </View>

        <View style={styles.tiles}>
          {OPTIONS.map(opt => (
            <OBSelectionTile
              key={opt.id}
              icon={
                <opt.Icon
                  size={24}
                  color={visitFrequency === opt.id ? '#E8A020' : '#8C93A0'}
                />
              }
              label={opt.label}
              sublabel={opt.sublabel}
              selected={visitFrequency === opt.id}
              onPress={() => setVisitFrequency(opt.id)}
              layout="stack"
            />
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <OBPrimaryButton
            label="Continue →"
            disabled={!visitFrequency}
            onPress={() => navigation.navigate('OB04_Goal')}
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
  tiles: {
    gap: 12,
  },
  visualWrap: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  ctaWrap: {
    marginTop: 24,
  },
});

export default OB03_Frequency;
