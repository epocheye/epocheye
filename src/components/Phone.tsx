import { StyleSheet, Text, TextInput, View } from 'react-native';
import React from 'react';

const Phone = () => {
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

const styles = StyleSheet.create({});
