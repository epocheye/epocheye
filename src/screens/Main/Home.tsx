import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
import { AudioLines, Search } from 'lucide-react-native';
import Map from '../../components/Map';
import Camera from '../../components/Camera';

const Home = () => {
  // Check permissions on this screen
  usePermissionCheck();

  const [select, setSelect] = useState('Map');

  return (
    <SafeAreaView className=" bg-[#111111] flex-1 px-5 justify-start items-center">
      <View className="justify-center items-center mb-5">
        <Text className="text-white text-3xl leading-tight font-montserrat-bold text-center">
          Good Evening, Sambit
        </Text>
        <Text className="text-white text-base mt-2 font-montserrat-medium text-center px-4">
          Where do you want to visit today?
        </Text>
      </View>

      <StatusBar hidden />
    </SafeAreaView>
  );
};

export default Home;
