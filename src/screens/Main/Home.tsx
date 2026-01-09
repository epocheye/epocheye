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
import { Bell, MapPin, ArrowRight, X, Loader } from 'lucide-react-native';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
import { usePlaces } from '../../context';

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

const DAILY_FACTS = [
  'Did you know? The sound of a clap made at the entrance of the Gol Gumbaz can be heard on the other side of the dome due to its whispering gallery.',
  'The Konark Sun Temple was shaped like a colossal chariot with 24 wheels, each 12 feet in diameter, pulled by seven horses.',
  "The Ajanta Caves hold some of the oldest paintings in India, dating back to the 2nd century BCE, depicting Buddha's previous lives.",
];

const Home = ({ navigation }: any) => {
  // Check permissions on this screen
  usePermissionCheck();

  const { nearbyPlaces, isLoadingNearby, nearbyError } = usePlaces();

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

  const handleVisitPlace = (place: any) => {
    // Convert Place to site format for SiteDetail screen
    const siteData = {
      id: place.id,
      name: place.name,
      location: place.formatted || `${place.city}, ${place.country}`,
      era: place.categories[0] || 'Historic',
      style: place.categories.join(', ') || 'Architecture',
      yearBuilt: 'Unknown',
      distance: `${(place.distance_meters / 1000).toFixed(1)} km`,
      estimatedTime: '45 min',
      heroImages: [
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      ],
      shortDescription: `Explore ${place.name} located at ${place.formatted}.`,
      fullDescription: `${place.name} is a historic site located at ${place.formatted}. Discover its rich history and cultural significance.`,
      funFacts: [],
      visitorTips: [
        'Best visited during early morning or late afternoon.',
        'Carry water and wear comfortable shoes.',
      ],
      relatedSites: [],
      rating: 4.5,
      reviews: 0,
      lat: place.lat,
      lon: place.lon,
      address_line1: place.address_line1,
      city: place.city,
      country: place.country,
    };
    navigation.navigate('SiteDetail', { site: siteData });
  };

  // Get a default image based on categories
  const getPlaceImage = (categories: string[]) => {
    const category = categories[0]?.toLowerCase() || '';
    if (category.includes('temple') || category.includes('religious')) {
      return 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80';
    }
    if (category.includes('fort') || category.includes('castle')) {
      return 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80';
    }
    return 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80';
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

        {/* Nearby Places */}
        <View className="mb-4">
          <Text className="text-white text-xl font-montserrat-semibold">
            Nearby Highlights
          </Text>
          {nearbyError && (
            <Text className="text-red-400 text-sm font-montserrat-medium mt-2">
              {nearbyError}
            </Text>
          )}
        </View>

        {isLoadingNearby ? (
          <View className="h-64 items-center justify-center">
            <Loader color="#FF7A18" size={32} />
            <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-4">
              Finding nearby places...
            </Text>
          </View>
        ) : nearbyPlaces.length === 0 ? (
          <View className="h-64 items-center justify-center">
            <MapPin color="#FF7A18" size={48} />
            <Text className="text-white text-lg font-montserrat-semibold mt-4">
              No nearby places found
            </Text>
            <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-2 text-center px-8">
              Try moving to a different location or check your permissions
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 12 }}
            style={{ marginHorizontal: -20, paddingLeft: 20 }}
          >
            {nearbyPlaces.slice(0, 10).map((place, index) => {
              const imageUri = getPlaceImage(place.categories);
              const distanceKm = (place.distance_meters / 1000).toFixed(1);
              const shortDescription = place.categories[0] || 'Historic site';

              return (
                <ImageBackground
                  key={place.id}
                  source={{ uri: imageUri }}
                  style={{ width: 220, height: 260, marginRight: 16 }}
                  imageStyle={{ borderRadius: 28 }}
                >
                  <TouchableOpacity
                    className="flex-1 justify-between rounded-[28px] p-4 bg-black/45"
                    onPress={() => handleVisitPlace(place)}
                    activeOpacity={0.8}
                  >
                    <View className="bg-white/20 rounded-full px-4 py-1 self-start">
                      <Text className="text-white text-xs font-montserrat-semibold">
                        {distanceKm} km away
                      </Text>
                    </View>
                    <View>
                      <Text
                        className="text-white text-2xl font-montserrat-bold"
                        numberOfLines={2}
                      >
                        {place.name}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <MapPin color="#FFFFFF" size={16} />
                        <Text
                          className="text-white text-sm font-montserrat-medium ml-1"
                          numberOfLines={1}
                        >
                          {place.city}, {place.country}
                        </Text>
                      </View>
                      <Text
                        className="text-white/85 text-sm font-montserrat-regular mt-3"
                        numberOfLines={2}
                      >
                        {shortDescription}
                      </Text>
                      <View className="mt-4 bg-white/90 rounded-full py-2 px-4 flex-row items-center self-start">
                        <Text className="text-black text-sm font-montserrat-semibold">
                          Explore
                        </Text>
                        <ArrowRight
                          color="#000000"
                          size={16}
                          className="ml-2"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                </ImageBackground>
              );
            })}
          </ScrollView>
        )}

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
