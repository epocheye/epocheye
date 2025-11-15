import { Image, StatusBar, Text, View, TouchableOpacity } from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
import { UserCircle } from 'lucide-react-native';
import Map from '../../components/Map';
import Camera from '../../components/Camera';

const Logo = require('../../assets/images/logo-white.png');
const Home = () => {
  // Check permissions on this screen
  usePermissionCheck();

  const [select, setSelect] = useState('Map');

  return (
    <SafeAreaView className=" bg-[#111111] flex-1 px-5 justify-start items-center">
      {/* Top-right user icon (absolute) */}
      <View className="absolute top-5 right-5">
        <UserCircle size={28} color="#FFFFFF" />
      </View>
      <View className="justify-center items-center mt-10 mb-5">
        <Text className="text-white text-3xl leading-tight font-montserrat-medium text-center">
          Good Morning Sambit
        </Text>
        <Text className="text-white text-base mt-2 font-montserrat-semibold text-center px-4">
          Where do you want to visit today?
        </Text>
      </View>
      <View className="w-full flex-row justify-center mb-6">
        <View className="flex-row items-center bg-black/60 rounded-full p-1">
          <TouchableOpacity
            onPress={() => setSelect('Map')}
            activeOpacity={0.8}
            className={`px-6 py-2 rounded-full ${
              select === 'Map' ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-base font-montserrat-semibold ${
                select === 'Map' ? 'text-black' : 'text-white'
              }`}
            >
              Map
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelect('Camera')}
            activeOpacity={0.8}
            className={`px-6 py-2 rounded-full ${
              select === 'Camera' ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-base font-montserrat-semibold ${
                select === 'Camera' ? 'text-black' : 'text-white'
              }`}
            >
              Camera
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Render selected view */}
      {select === 'Map' ? <Camera /> : <Camera />}
      <StatusBar hidden />
    </SafeAreaView>
  );
};

export default Home;
