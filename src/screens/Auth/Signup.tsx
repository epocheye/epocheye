import { Text, View } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import Email from '../../components/Email';

interface Props {
  navigation: NavigationProp<any>;
}

const Signup: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView className="flex-1 bg-[#111111] py-5 px-8">
      <View className="items-center justify-center my-5">
        <Text className="text-white font-montserrat-bold text-3xl">
          Create your account
        </Text>
      </View>
      <Email navigation={navigation} />
    </SafeAreaView>
  );
};

export default Signup;
