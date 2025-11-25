import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Map from '../../components/Map';
import { AudioLines, Search } from 'lucide-react-native';
import Camera from '../../components/Camera';

const Explore = () => {
  const [select, setSelect] = useState('Map');
  return (
    <SafeAreaView className="flex-1 bg-[#111111] px-5 pt-6">
      <Text className="text-white text-2xl font-montserrat-medium mb-4 text-center">
        Discover Places Around You
      </Text>
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
      {select === 'Map' ? <Map /> : <Camera />}
      <View className="justify-between items-center w-full bg-[#222222] border border-[#464646] my-7 rounded-full py-2 px-5 flex-row">
        <Search size={26} color="white" />
        <TextInput
          placeholder="Search any Location"
          placeholderTextColor="#888888"
          className=" text-white ml-3 font-montserrat-medium"
        />
        <AudioLines size={26} color="white" />
      </View>
    </SafeAreaView>
  );
};

export default Explore;
