import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

const Saved = () => {
  return (
    <SafeAreaView className="flex-1 bg-[#111111] px-5 pt-10">
      <Text className="text-white text-3xl font-montserrat-bold mb-4">
        Saved Places
      </Text>
      <View className="bg-[#1E1E1E] rounded-3xl px-6 py-8 border border-[#333333]">
        <Text className="text-white text-base font-montserrat-medium text-center">
          You don't have any saved spots yet.
        </Text>
        <Text className="text-[#9A9A9A] text-sm font-montserrat-regular text-center mt-3">
          Start exploring historical locations and save your favorites for a
          quick revisit.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default Saved;
