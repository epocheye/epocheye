import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Moon, Flame, Zap } from 'lucide-react-native';
import { OB_COLORS, OB_TYPOGRAPHY } from '../../constants/onboarding';
import { useOnboardingStore } from '../../stores/onboardingStore';
import OBProgressBar from '../../components/onboarding/OBProgressBar';
import OBPrimaryButton from '../../components/onboarding/OBPrimaryButton';
import OBSelectionTile from '../../components/onboarding/OBSelectionTile';
import OnboardingResolvedVisual from '../../components/onboarding/OnboardingResolvedVisual';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';

type Props = OnboardingScreenProps<'OB04_Goal'>;

const OPTIONS = [
  { id: 'monthly', label: 'Once a month', badge: 'Easy', Icon: Moon },
  { id: 'weekly', label: 'Once a week', badge: 'Recommended', Icon: Flame },
  {
    id: 'every_visit',
    label: 'Every site visit',
    badge: 'Explorer',
    Icon: Zap,
  },
] as const;

const GOAL_SUBJECTS: Record<(typeof OPTIONS)[number]['id'], string> = {
  monthly: 'Monthly heritage discovery journey',
  weekly: 'Weekly ancestral exploration milestones',
  every_visit: 'Every monument visit reveals ancestry',
};

const OB04_Goal: React.FC<Props> = ({ navigation }) => {
  const goal = useOnboardingStore(s => s.goal);
  const setGoal = useOnboardingStore(s => s.setGoal);
  const insets = useSafeAreaInsets();
  const subject = goal
    ? GOAL_SUBJECTS[goal]
    : 'Setting an ancestry discovery goal';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <OBProgressBar current={3} total={10} />

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={[OB_TYPOGRAPHY.heading, styles.heading]}>
            How often do you want to discover ancestors?
          </Text>
          <Text style={OB_TYPOGRAPHY.sub}>
            Setting a goal doubles your chances of sticking with it.
          </Text>
        </View>

        <View style={styles.visualWrap}>
          <OnboardingResolvedVisual
            subject={subject}
            context="onboarding discovery goal"
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
                  color={goal === opt.id ? '#E8A020' : '#8C93A0'}
                />
              }
              label={opt.label}
              badge={opt.badge}
              selected={goal === opt.id}
              onPress={() => setGoal(opt.id)}
              layout="stack"
            />
          ))}
        </View>

        <View style={styles.ctaWrap}>
          <OBPrimaryButton
            label="Continue →"
            onPress={() => navigation.navigate('OB05_Region')}
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

export default OB04_Goal;
