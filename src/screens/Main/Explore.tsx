import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Map from '../../components/Map';
import { AudioLines, Search } from 'lucide-react-native';
import Camera from '../../components/Camera';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

const Explore = () => {
  const [select, setSelect] = useState('Map');

  const slideUp = useSharedValue(20);
  const fadeIn = useSharedValue(0);

  React.useEffect(() => {
    slideUp.value = withSpring(0, { damping: 20, stiffness: 200 });
    fadeIn.value = withTiming(1, { duration: 350 });
  }, [fadeIn, slideUp]);

  const entryStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideUp.value }],
    opacity: fadeIn.value,
  }));

  const isMap = select === 'Map';

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]">
      <LinearGradient
        colors={['#0A0A0A', '#14110B', '#0A0A0A']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        <AnimatedView className="flex-1 px-5 pt-5" style={entryStyle}>
          <Text className="font-['MontserratAlternates-SemiBold'] text-xs uppercase tracking-[1px] text-[#C9A84C]">
            EXPLORE THE ERA
          </Text>
          <Text className="mt-1 font-['MontserratAlternates-Bold'] text-[28px] leading-9 text-[#F5F0E8]">
            Discover Places Around You
          </Text>
          <Text className="mb-4 mt-2 font-['MontserratAlternates-Regular'] text-sm leading-5 text-[#B8AF9E]">
            Switch between live map and camera discovery as you walk.
          </Text>

          <View className="mb-4 flex-row items-center rounded-full border border-[rgba(201,168,76,0.3)] bg-[#141414] px-4 py-2.5">
            <Search size={20} color="#B8AF9E" />
            <TextInput
              placeholder="Search a monument or city"
              placeholderTextColor="#6B6357"
              className="mx-2.5 flex-1 font-['MontserratAlternates-Medium'] text-sm leading-5 text-[#F5F0E8]"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Voice Search"
            >
              <AudioLines size={20} color="#C9A84C" />
            </TouchableOpacity>
          </View>

          <View className="mb-4 flex-row rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1C1C1C] p-1">
            <TouchableOpacity
              onPress={() => setSelect('Map')}
              activeOpacity={0.85}
              className={`flex-1 items-center justify-center rounded-full py-2.5 ${
                isMap ? 'bg-[#C9A84C]' : ''
              }`}
            >
              <Text
                className={`font-['MontserratAlternates-SemiBold'] text-sm leading-5 ${
                  isMap ? 'text-[#0A0A0A]' : 'text-[#B8AF9E]'
                }`}
              >
                Map
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelect('Camera')}
              activeOpacity={0.85}
              className={`flex-1 items-center justify-center rounded-full py-2.5 ${
                !isMap ? 'bg-[#C9A84C]' : ''
              }`}
            >
              <Text
                className={`font-['MontserratAlternates-SemiBold'] text-sm leading-5 ${
                  !isMap ? 'text-[#0A0A0A]' : 'text-[#B8AF9E]'
                }`}
              >
                Camera
              </Text>
            </TouchableOpacity>
          </View>

          <View className="overflow-hidden rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#141414]">
            {isMap ? <Map /> : <Camera />}
          </View>

          <View className="mt-4 rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[#141414] p-4">
            <Text className="mb-1 font-['MontserratAlternates-SemiBold'] text-[11px] uppercase tracking-[0.8px] text-[#C9A84C]">
              HERITAGE TIP
            </Text>
            <Text className="font-['MontserratAlternates-Regular'] text-[13px] leading-[18px] text-[#B8AF9E]">
              Move closer to landmark clusters for richer AR reconstructions and
              timeline overlays.
            </Text>
          </View>
        </AnimatedView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default Explore;
