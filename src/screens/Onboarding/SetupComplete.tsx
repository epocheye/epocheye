import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle,
  Sparkles,
  MapPin,
  Clock,
  Star,
  ChevronRight,
  Trophy,
} from 'lucide-react-native';
import type { UserPreferences } from './Questionnaire';

interface SetupCompleteProps {
  preferences: UserPreferences;
  onGoHome: () => void;
}

// Preview cards for personalized feed
const PREVIEW_CARDS = [
  {
    id: 'card-1',
    title: "Humayun's Tomb",
    location: 'Delhi',
    distance: '2.4 km',
    rating: 4.8,
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80',
    tag: 'Heritage Site',
  },
  {
    id: 'card-2',
    title: 'Lotus Temple',
    location: 'Delhi',
    distance: '5.1 km',
    rating: 4.6,
    image:
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=400&q=80',
    tag: 'Temple',
  },
  {
    id: 'card-3',
    title: 'Red Fort',
    location: 'Delhi',
    distance: '8.3 km',
    rating: 4.5,
    image:
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=400&q=80',
    tag: 'Fort',
  },
];

const QUICK_TIPS = [
  {
    icon: MapPin,
    title: 'Explore Nearby',
    description: 'Tap "Explore" to find sites around you',
  },
  {
    icon: Clock,
    title: 'Time Travel',
    description: 'Use AR to see monuments in their past glory',
  },
  {
    icon: Trophy,
    title: 'Earn Badges',
    description: 'Visit sites and complete challenges',
  },
];

const SetupComplete: React.FC<SetupCompleteProps> = ({
  preferences,
  onGoHome,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  const getInterestLabels = () => {
    const labels: Record<string, string> = {
      heritage: 'Heritage Sites',
      temples: 'Temples',
      nature: 'Nature',
      museums: 'Museums',
      forts: 'Forts & Palaces',
      beaches: 'Beaches',
      mountains: 'Mountains',
      other: 'Other',
    };
    return preferences.interests.map(id => labels[id] || id).slice(0, 3);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#070709]">
      <StatusBar barStyle="light-content" />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Success Header */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          }}
          className="items-center pt-8 pb-6 px-6"
        >
          {/* Success Icon */}
          <View className="w-24 h-24 rounded-full bg-[#10B981]/20 items-center justify-center mb-6">
            <View className="w-16 h-16 rounded-full bg-[#10B981] items-center justify-center">
              <CheckCircle color="#FFFFFF" size={36} />
            </View>
          </View>

          <Text className="text-white text-3xl font-montserrat-bold text-center mb-3">
            You're All Set!
          </Text>
          <Text className="text-[#8D8D92] text-base font-montserrat-regular text-center px-4 leading-6">
            Your personalized heritage journey awaits. Start exploring and
            unlock the stories of the past.
          </Text>
        </Animated.View>

        {/* User Preferences Summary */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
          className="mx-6 mb-6"
        >
          <View className="bg-[#12121A] rounded-3xl p-5 border border-[#272730]">
            <View className="flex-row items-center mb-4">
              <Sparkles color="#FF7A18" size={20} />
              <Text className="text-white text-lg font-montserrat-semibold ml-2">
                Your Profile
              </Text>
            </View>

            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 rounded-full bg-[#FF7A18]/20 items-center justify-center">
                <MapPin color="#FF7A18" size={16} />
              </View>
              <Text className="text-[#B4B4BA] text-base font-montserrat-medium ml-3">
                Based in{' '}
                <Text className="text-white font-montserrat-semibold">
                  {preferences.location}
                </Text>
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2 mt-2">
              {getInterestLabels().map((label, index) => (
                <View
                  key={index}
                  className="bg-[#FF7A18]/15 px-3 py-1 rounded-full"
                >
                  <Text className="text-[#FF7A18] text-sm font-montserrat-medium">
                    {label}
                  </Text>
                </View>
              ))}
              {preferences.interests.length > 3 && (
                <View className="bg-[#272730] px-3 py-1 rounded-full">
                  <Text className="text-[#8D8D92] text-sm font-montserrat-medium">
                    +{preferences.interests.length - 3} more
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Personalized Feed Preview */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
          className="mb-6"
        >
          <View className="flex-row items-center justify-between px-6 mb-4">
            <Text className="text-white text-lg font-montserrat-semibold">
              Recommended for You
            </Text>
            <View className="bg-[#10B981]/20 px-3 py-1 rounded-full">
              <Text className="text-[#10B981] text-xs font-montserrat-semibold">
                Preview
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24 }}
          >
            {PREVIEW_CARDS.map(card => (
              <View
                key={card.id}
                className="w-44 mr-4 bg-[#12121A] rounded-2xl overflow-hidden border border-[#272730]"
              >
                <Image
                  source={{ uri: card.image }}
                  className="w-full h-24"
                  resizeMode="cover"
                />
                <View className="p-3">
                  <View className="bg-[#FF7A18]/20 px-2 py-0.5 rounded-full self-start mb-2">
                    <Text className="text-[#FF7A18] text-xs font-montserrat-medium">
                      {card.tag}
                    </Text>
                  </View>
                  <Text
                    className="text-white text-sm font-montserrat-semibold mb-1"
                    numberOfLines={1}
                  >
                    {card.title}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[#8D8D92] text-xs font-montserrat-medium">
                      {card.distance}
                    </Text>
                    <View className="flex-row items-center">
                      <Star color="#FFB347" size={12} fill="#FFB347" />
                      <Text className="text-white text-xs font-montserrat-medium ml-1">
                        {card.rating}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Quick Tips */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
          className="px-6"
        >
          <Text className="text-white text-lg font-montserrat-semibold mb-4">
            Getting Started
          </Text>

          {QUICK_TIPS.map((tip, index) => (
            <View
              key={index}
              className="flex-row items-center bg-[#12121A] rounded-2xl p-4 mb-3 border border-[#272730]"
            >
              <View className="w-12 h-12 rounded-2xl bg-[#1F1F2A] items-center justify-center">
                <tip.icon color="#FF7A18" size={24} />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-white text-base font-montserrat-semibold">
                  {tip.title}
                </Text>
                <Text className="text-[#8D8D92] text-sm font-montserrat-regular mt-0.5">
                  {tip.description}
                </Text>
              </View>
              <ChevronRight color="#4A4A52" size={20} />
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-gradient-to-t from-[#070709] via-[#070709] to-transparent">
        <TouchableOpacity
          onPress={onGoHome}
          className="bg-[#FF7A18] rounded-2xl py-4 flex-row items-center justify-center"
        >
          <Text className="text-white text-lg font-montserrat-semibold mr-2">
            Go to Home
          </Text>
          <ChevronRight color="#FFFFFF" size={22} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default SetupComplete;
