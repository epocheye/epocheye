import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
} from 'react-native';
import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Camera,
  MapPin,
  ArrowRight,
  ChevronRight,
  Star,
  Crown,
  Compass,
  Medal,
  X,
} from 'lucide-react-native';
import { usePermissionCheck } from '../../utils/usePermissionCheck';

const profilePlaceholder = require('../../assets/images/logo-white.png');

const TRENDING_SITES = [
  {
    id: 'site-1',
    name: 'Humayun’s Tomb',
    location: 'Delhi, India',
    fact: 'Mughal architecture masterpiece from 1570.',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'site-2',
    name: 'Qutub Minar',
    location: 'Delhi, India',
    fact: 'World’s tallest brick minaret at 73 meters.',
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'site-3',
    name: 'Red Fort',
    location: 'Delhi, India',
    fact: 'Mughal palace fort and UNESCO site.',
    image:
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
  },
];

const BADGES = [
  { id: 'badge-1', label: 'Time Traveler', icon: Star },
  { id: 'badge-2', label: 'Heritage Hero', icon: Crown },
  { id: 'badge-3', label: 'Trailblazer', icon: Compass },
  { id: 'badge-4', label: 'Archivist', icon: Medal },
];

const DAILY_FACTS = [
  'Did you know? The sound of a clap made at the entrance of the Gol Gumbaz can be heard on the other side of the dome due to its whispering gallery.',
  'The Konark Sun Temple was shaped like a colossal chariot with 24 wheels, each 12 feet in diameter, pulled by seven horses.',
  'The Ajanta Caves hold some of the oldest paintings in India, dating back to the 2nd century BCE, depicting Buddha’s previous lives.',
];

const Home = ({ navigation }: any) => {
  // Check permissions on this screen
  usePermissionCheck();

  const [factIndex, setFactIndex] = useState(0);
  const [factVisible, setFactVisible] = useState(true);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const currentFact = DAILY_FACTS[factIndex % DAILY_FACTS.length];

  const handleNextFact = () => {
    setFactIndex(prev => (prev + 1) % DAILY_FACTS.length);
    setFactVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#070709]">
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {/* Top Greeting Bar */}
        <View className="flex-row items-center justify-between mt-4 mb-6">
          <View className="flex-1 pr-4">
            <Text className="text-[#BEBEC2] text-sm font-montserrat-medium uppercase tracking-widest">
              {greeting},
            </Text>
            <Text className="text-white text-3xl font-montserrat-bold mt-1">
              Sambit
            </Text>
            <Text className="text-[#8D8D92] text-base font-montserrat-medium mt-1">
              Ready to unlock a new monument?
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity className="w-11 h-11 rounded-full bg-[#12121A] border border-[#272730] items-center justify-center">
              <Bell color="#FFFFFF" size={22} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scan Monument CTA */}
        {/* <TouchableOpacity
          activeOpacity={0.9}
          className="bg-[#FF7A18] rounded-3xl px-6 py-1 shadow-lg shadow-black/40 mb-8"
          onPress={() => navigation.navigate('Explore')}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-white text-xl font-montserrat-bold">
                Scan
              </Text>
            </View>
            <View className="size-12 rounded-full bg-white/20 items-center justify-center">
              <Camera color="#FFFFFF" size={22} />
            </View>
          </View>
        </TouchableOpacity> */}

        {/* Trending Sites */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-xl font-montserrat-semibold">
            Nearby Highlights
          </Text>
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => navigation.navigate('Explore')}
          >
            <Text className="text-[#B4B4BA] text-sm font-montserrat-medium mr-1">
              View Map
            </Text>
            <ChevronRight color="#B4B4BA" size={18} />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 12 }}
          style={{ marginHorizontal: -20, paddingLeft: 20 }}
        >
          {TRENDING_SITES.map(site => (
            <ImageBackground
              key={site.id}
              source={{ uri: site.image }}
              style={{ width: 220, height: 260, marginRight: 16 }}
              imageStyle={{ borderRadius: 28 }}
            >
              <View className="flex-1 justify-between rounded-[28px] p-4 bg-black/45">
                <View className="bg-white/20 rounded-full px-4 py-1 self-start">
                  <Text className="text-white text-xs font-montserrat-semibold">
                    Trending
                  </Text>
                </View>
                <View>
                  <Text className="text-white text-2xl font-montserrat-bold">
                    {site.name}
                  </Text>
                  <View className="flex-row items-center mt-2">
                    <MapPin color="#FFFFFF" size={16} />
                    <Text className="text-white text-sm font-montserrat-medium ml-1">
                      {site.location}
                    </Text>
                  </View>
                  <Text className="text-white/85 text-sm font-montserrat-regular mt-3">
                    {site.fact}
                  </Text>
                  <TouchableOpacity className="mt-4 bg-white/90 rounded-full py-2 px-4 flex-row items-center self-start">
                    <Text className="text-black text-sm font-montserrat-semibold">
                      Start Tour
                    </Text>
                    <ArrowRight color="#000000" size={16} className="ml-2" />
                  </TouchableOpacity>
                </View>
              </View>
            </ImageBackground>
          ))}
        </ScrollView>

        {/* Badges */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-xl font-montserrat-semibold">
              Earned Badges
            </Text>
            <TouchableOpacity>
              <Text className="text-[#FF7A18] text-sm font-montserrat-semibold">
                View All
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 10 }}
          >
            {BADGES.map(badge => {
              const Icon = badge.icon;
              return (
                <View
                  key={badge.id}
                  className="w-28 h-32 bg-[#13131B] rounded-3xl mr-4 border border-[#232330] items-center justify-center"
                >
                  <View className="w-12 h-12 rounded-full bg-[#1F1F2A] items-center justify-center mb-3">
                    <Icon color="#FFB347" size={26} />
                  </View>
                  <Text className="text-white text-sm font-montserrat-medium text-center px-2">
                    {badge.label}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Daily Fact */}
        {factVisible && (
          <View className="bg-[#14141D] rounded-[30px] mt-8 p-6 border border-[#232330]">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-lg font-montserrat-semibold">
                Daily Fact
              </Text>
              <TouchableOpacity onPress={() => setFactVisible(false)}>
                <X color="#7A7A85" size={22} />
              </TouchableOpacity>
            </View>
            <Text className="text-[#D8D8E0] text-base font-montserrat-medium leading-6">
              {currentFact}
            </Text>
            <View className="flex-row items-center justify-end mt-4">
              <TouchableOpacity
                onPress={handleNextFact}
                className="flex-row items-center"
              >
                <Text className="text-[#FF7A18] text-sm font-montserrat-semibold mr-2">
                  Next Tip
                </Text>
                <ArrowRight color="#FF7A18" size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;
