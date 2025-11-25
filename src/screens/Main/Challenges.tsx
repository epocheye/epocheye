import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Trophy, Target, Award, Sparkles } from 'lucide-react-native';

const CHALLENGES = [
  {
    id: 'challenge-1',
    title: 'Seven Sites Sprint',
    description: 'Scan seven monuments this week to unlock the Horizon badge.',
    progress: '3 / 7 completed',
    icon: Trophy,
  },
  {
    id: 'challenge-2',
    title: 'Architectural Detective',
    description: 'Spot three gothic arches using AR overlays.',
    progress: '1 / 3 completed',
    icon: Target,
  },
  {
    id: 'challenge-3',
    title: 'Cultural Curator',
    description: 'Collect five oral history clips from local experts.',
    progress: '0 / 5 collected',
    icon: Award,
  },
];

const Challenges = () => {
  return (
    <SafeAreaView className="flex-1 bg-[#070709] pt-10 px-5">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-white text-3xl font-montserrat-bold mb-6">
          Weekly Challenges
        </Text>
        {CHALLENGES.map(challenge => {
          const Icon = challenge.icon;
          return (
            <View
              key={challenge.id}
              className="bg-[#13131B] rounded-3xl border border-[#1F1F29] p-5 mb-4"
            >
              <View className="flex-row items-center mb-4">
                <View className="w-12 h-12 rounded-2xl bg-[#1E1E28] items-center justify-center mr-3">
                  <Icon color="#FFB347" size={26} />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-lg font-montserrat-semibold">
                    {challenge.title}
                  </Text>
                  <Text className="text-[#9D9DA8] text-sm font-montserrat-regular">
                    {challenge.description}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-[#FF7A18] text-sm font-montserrat-semibold">
                  {challenge.progress}
                </Text>
                <TouchableOpacity className="flex-row items-center">
                  <Text className="text-white text-sm font-montserrat-semibold mr-2">
                    Continue
                  </Text>
                  <Sparkles color="#FFFFFF" size={18} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Challenges;
