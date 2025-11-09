import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationProp } from '@react-navigation/native';
import Email from '../../components/Email';
import Phone from '../../components/Phone';

interface Props {
  navigation: NavigationProp<any>;
}

const Signup: React.FC<Props> = ({ navigation }) => {
  const [signupWith, setSignupWith] = useState<string>('email');
  return (
    <SafeAreaView className="flex-1 bg-[#111111] py-5 px-8">
      <View className="items-center justify-center my-5">
        <Text className="text-white font-bold text-2xl">
          Create your account
        </Text>
      </View>
      <View className="flex-row justify-between items-center bg-[#191919] p-1 rounded-full w-4/5 self-center mb-5 gap-2">
        <TouchableOpacity
          className={`py-2 w-1/2 items-center rounded-full ${
            signupWith === 'email' ? 'bg-white' : ''
          }`}
          onPress={() => setSignupWith('email')}
        >
          <Text
            className={`font-montserrat-semibold ${
              signupWith === 'email' ? 'text-black' : 'text-white'
            }`}
          >
            Email
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`py-2 w-1/2 items-center rounded-full ${
            signupWith === 'phone' ? 'bg-white' : ''
          }`}
          onPress={() => setSignupWith('phone')}
        >
          <Text
            className={`font-montserrat-semibold ${
              signupWith === 'phone' ? 'text-black' : 'text-white'
            }`}
          >
            Phone
          </Text>
        </TouchableOpacity>
      </View>
      {signupWith === 'email' ? <Email /> : <Phone />}
    </SafeAreaView>
  );
};

export default Signup;

const styles = StyleSheet.create({});
