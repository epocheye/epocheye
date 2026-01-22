import React from 'react';
import { Text, TextInput, View } from 'react-native';

const Phone: React.FC = () => {
  return (
    <View className="my-10">
      <Text className="text-gray-300 font-montserrat-semibold text-lg">
        Phone Number
      </Text>
      <TextInput
        placeholder="Enter your phone number"
        keyboardType="phone-pad"
        className="bg-black"
      />
    </View>
  );
};

export default Phone;
