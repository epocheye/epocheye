import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Image } from 'react-native';

const Profile = () => {
  return (
    <SafeAreaView className="flex-1 bg-[#111111] px-5 pt-10 items-center">
      <Image
        source={require('../../assets/images/logo-white.png')}
        className="w-24 h-24 mb-6"
        resizeMode="contain"
      />
      <Text className="text-white text-3xl font-montserrat-bold">
        Sambit Das
      </Text>
      <Text className="text-[#9A9A9A] text-base font-montserrat-medium mt-1">
        Historian & Explorer
      </Text>

      <View className="w-full bg-[#1E1E1E] rounded-3xl mt-8 px-6 py-4 border border-[#333333]">
        <Text className="text-white text-lg font-montserrat-semibold">
          Profile Overview
        </Text>
        <Text className="text-[#CFCFCF] text-sm font-montserrat-regular mt-3">
          Your personalized profile with saved routes, exploration stats, and
          access preferences will appear here soon.
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default Profile;
