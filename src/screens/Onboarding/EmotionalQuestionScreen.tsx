import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import DustMotes from '../../components/onboarding/DustMotes';
import type { OnboardingScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants/routes';

type Props = OnboardingScreenProps<'EmotionalQuestion'>;

/**
 * Screen 2 — Emotional hook question with floating dust motes.
 * Two tappable answer cards navigate to MirrorMoment with { answer }.
 */
const EmotionalQuestionScreen: React.FC<Props> = ({ navigation }) => {
  const handleAnswer = (answer: 'yes' | 'no') => {
    navigation.navigate(ROUTES.ONBOARDING.MIRROR_MOMENT, { answer });
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <DustMotes />

      <View style={styles.content}>
        <Text style={styles.question}>
          Have you ever stood at a monument and felt… nothing?
        </Text>

        <View style={styles.cards}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handleAnswer('yes')}
          >
            <Text style={styles.cardText}>Yes, honestly</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handleAnswer('no')}
          >
            <Text style={styles.cardText}>No, history moves me</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1612',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  question: {
    fontFamily: 'CormorantGaramond-SemiBold',
    fontSize: 44,
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 48,
    lineHeight: 56,
  },
  cards: {
    width: '100%',
    gap: 16,
  },
  card: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default EmotionalQuestionScreen;
