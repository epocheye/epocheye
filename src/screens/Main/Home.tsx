import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Pressable,
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
    name: "Humayun's Tomb",
    location: 'Delhi, India',
    fact: 'Mughal architecture masterpiece from 1570.',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
    fullData: {
      id: 'humayuns-tomb',
      name: "Humayun's Tomb",
      location: 'Nizamuddin East, Delhi, India',
      era: 'Mughal Era',
      style: 'Persian-Mughal Architecture',
      yearBuilt: '1570 CE',
      distance: '2.4 km',
      estimatedTime: '45 min',
      heroImages: [
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1585135497273-1a86b09fe70e?auto=format&fit=crop&w=1200&q=80',
      ],
      shortDescription:
        "Humayun's Tomb is a UNESCO World Heritage Site and the tomb of the Mughal Emperor Humayun, commissioned by Empress Bega Begum in 1558.",
      fullDescription:
        "Humayun's Tomb is a UNESCO World Heritage Site and the tomb of the Mughal Emperor Humayun. It was commissioned by his first wife, Empress Bega Begum, in 1558, and designed by Persian architects.",
      funFacts: [
        {
          id: 'fact-1',
          icon: 'star',
          title: 'Inspiration for Taj Mahal',
          description:
            'This tomb inspired the Taj Mahal, built 70 years later.',
        },
        {
          id: 'fact-2',
          icon: 'compass',
          title: 'Perfect Symmetry',
          description: 'The tomb is perfectly symmetrical on all four sides.',
        },
        {
          id: 'fact-3',
          icon: 'flower',
          title: 'Char Bagh Garden',
          description:
            'The Persian-style garden is divided into 36 square plots.',
        },
      ],
      visitorTips: [
        'Best visited during early morning.',
        'Carry water during summer months.',
        'Hire a local guide for deeper insights.',
      ],
      relatedSites: [
        {
          id: 'related-1',
          name: 'Taj Mahal',
          location: 'Agra, India',
          image:
            'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=400&q=80',
          distance: '210 km',
        },
        {
          id: 'related-2',
          name: 'Qutub Minar',
          location: 'Delhi, India',
          image:
            'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=80',
          distance: '12 km',
        },
      ],
      rating: 4.8,
      reviews: 2847,
    },
  },
  {
    id: 'site-2',
    name: 'Qutub Minar',
    location: 'Delhi, India',
    fact: "World's tallest brick minaret at 73 meters.",
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
    fullData: {
      id: 'qutub-minar',
      name: 'Qutub Minar',
      location: 'Mehrauli, Delhi, India',
      era: 'Delhi Sultanate',
      style: 'Indo-Islamic Architecture',
      yearBuilt: '1193 CE',
      distance: '8.5 km',
      estimatedTime: '60 min',
      heroImages: [
        'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
      ],
      shortDescription:
        'The Qutub Minar is a 73-meter tall minaret built in 1193. It is a UNESCO World Heritage Site.',
      fullDescription:
        'The Qutub Minar is a 73-meter tall minaret that forms part of the Qutb complex, a UNESCO World Heritage Site in Mehrauli, South Delhi.',
      funFacts: [
        {
          id: 'fact-1',
          icon: 'star',
          title: 'Tallest Brick Minaret',
          description:
            'At 73 meters, it is the tallest brick minaret in the world.',
        },
        {
          id: 'fact-2',
          icon: 'compass',
          title: 'Leaning Tower',
          description: 'The tower has a slight tilt of about 65 cm.',
        },
      ],
      visitorTips: [
        'Visit early morning to avoid crowds.',
        'The Iron Pillar nearby is equally fascinating.',
      ],
      relatedSites: [
        {
          id: 'related-1',
          name: "Humayun's Tomb",
          location: 'Delhi, India',
          image:
            'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80',
          distance: '12 km',
        },
      ],
      rating: 4.6,
      reviews: 3521,
    },
  },
  {
    id: 'site-3',
    name: 'Red Fort',
    location: 'Delhi, India',
    fact: 'Mughal palace fort and UNESCO site.',
    image:
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
    fullData: {
      id: 'red-fort',
      name: 'Red Fort',
      location: 'Old Delhi, India',
      era: 'Mughal Era',
      style: 'Mughal Architecture',
      yearBuilt: '1648 CE',
      distance: '5.2 km',
      estimatedTime: '90 min',
      heroImages: [
        'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
      ],
      shortDescription:
        'The Red Fort is a historic fort in Old Delhi that served as the main residence of the Mughal Emperors.',
      fullDescription:
        'The Red Fort is a historic fort in Old Delhi, India, that served as the main residence of the Mughal Emperors. Emperor Shah Jahan commissioned construction of the Red Fort on 12 May 1638.',
      funFacts: [
        {
          id: 'fact-1',
          icon: 'star',
          title: 'Independence Day',
          description:
            'The Prime Minister hoists the flag here every Independence Day.',
        },
        {
          id: 'fact-2',
          icon: 'compass',
          title: 'Massive Walls',
          description: 'The walls extend for 2.41 km and are up to 33 m high.',
        },
      ],
      visitorTips: [
        'Evening sound and light show is a must-see.',
        'Combine with a walk through Chandni Chowk.',
      ],
      relatedSites: [
        {
          id: 'related-1',
          name: 'Jama Masjid',
          location: 'Delhi, India',
          image:
            'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=400&q=80',
          distance: '0.5 km',
        },
      ],
      rating: 4.5,
      reviews: 5234,
    },
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
  "The Ajanta Caves hold some of the oldest paintings in India, dating back to the 2nd century BCE, depicting Buddha's previous lives.",
];

const Home = ({ navigation }: any) => {
  // Check permissions on this screen
  usePermissionCheck();

  const [factIndex, setFactIndex] = useState(0);
  const [factVisible, setFactVisible] = useState(true);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 16) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const currentFact = DAILY_FACTS[factIndex % DAILY_FACTS.length];

  const handleNextFact = () => {
    setFactIndex(prev => (prev + 1) % DAILY_FACTS.length);
    setFactVisible(true);
  };

  const handleStartTour = (site: any) => {
    navigation.navigate('SiteDetail', { site: site.fullData });
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
              Sambit Singha
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
              <TouchableOpacity
                className="flex-1 justify-between rounded-[28px] p-4 bg-black/45"
                onPress={() => handleStartTour(site)}
                activeOpacity={0.8}
              >
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
                  <View className="mt-4 bg-white/90 rounded-full py-2 px-4 flex-row items-center self-start">
                    <Text className="text-black text-sm font-montserrat-semibold">
                      Start Tour
                    </Text>
                    <ArrowRight color="#000000" size={16} className="ml-2" />
                  </View>
                </View>
              </TouchableOpacity>
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
