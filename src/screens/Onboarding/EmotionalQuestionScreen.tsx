import React from 'react';
import { View, Text, StatusBar, TouchableOpacity } from 'react-native';
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
    <View className="flex-1 bg-[#1A1612]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <DustMotes />

      <View className="flex-1 items-center justify-center px-6">
        <Text className="mb-12 max-w-[300px] text-center font-['CormorantGaramond-SemiBold'] text-[44px] leading-[56px] text-white">
          Have you ever stood at a monument and felt… nothing?
        </Text>

        <View className="w-full gap-4">
          <TouchableOpacity
            className="h-14 w-full items-center justify-center rounded-xl border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.05)]"
            activeOpacity={0.7}
            onPress={() => handleAnswer('yes')}
          >
            <Text className="font-['DMSans-Medium'] text-base text-white">
              Yes, honestly
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="h-14 w-full items-center justify-center rounded-xl border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.05)]"
            activeOpacity={0.7}
            onPress={() => handleAnswer('no')}
          >
            <Text className="font-['DMSans-Medium'] text-base text-white">
              No, history moves me
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default EmotionalQuestionScreen;
