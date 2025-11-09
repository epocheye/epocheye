import {
  ImageBackground,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
const bgImage: any = require('../../assets/images/landing-bg.jpg');
interface Props {
  navigation: {
    navigate: (screen: string) => void;
  };
}

const Landing = ({ navigation }: Props) => {
  return (
    <SafeAreaView>
      <ImageBackground
        source={bgImage}
        resizeMode="cover"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <View className="flex-1 justify-between items-center py-20">
          <View className="justify-center items-center gap-5">
            <Text className="font-montserrat-bold text-white text-5xl">
              Epocheye
            </Text>
            <Text className="text-white text-center font-montserrat-bold text-xl">
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
      <StatusBar barStyle="light-content" backgroundColor="black" />
    </SafeAreaView>
  );
};

export default Landing;
