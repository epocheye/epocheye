import {
  Image,
  ImageBackground,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

const bgImage: any = require('../../assets/images/bg.webp');
const underline: any = require('../../assets/images/vector.png');

interface Props {
  navigation: {
    navigate: (screen: string) => void;
  };
}

const Landing = ({ navigation }: Props) => {
  return (
    <View>
      <ImageBackground
        source={bgImage}
        resizeMode="cover"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <View className="flex-1 justify-center items-center py-20 gap-20">
          <View className="justify-center items-center gap-5">
            <View className="w-full relative">
              <Text className="font-montserrat-bold text-black text-6xl leading-tight">
                Epocheye
              </Text>
              <Image source={underline} className="absolute top-16" />
            </View>
            <Text className="text-black text-center font-montserrat-bold text-xl">
              Turn Your Phone into Time Machine
            </Text>
          </View>
          <View className="justify-center items-center flex-row gap-5">
            <TouchableOpacity
              className="bg-white w-40 py-2 rounded-3xl"
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Register')}
            >
              <Text className="text-lg font-montserrat-semibold text-center">
                Register
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-black w-40 py-2 rounded-3xl"
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Login')}
            >
              <Text className="text-lg font-montserrat-semibold text-white text-center">
                Login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
      <StatusBar hidden />
    </View>
  );
};

export default Landing;
