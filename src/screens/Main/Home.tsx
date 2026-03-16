import {
  StatusBar,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ImageBackground,
} from 'react-native';
import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, MapPin, ArrowRight, X, Loader } from 'lucide-react-native';
import { usePermissionCheck } from '../../utils/usePermissionCheck';
import { usePlaces } from '../../context';
import { useUser } from '../../context';
import type { TabScreenProps } from '../../core/types/navigation.types';
import type { Place } from '../../utils/api/places/types';

// Rotating historical facts shown in the "Daily Fact" card.
// These are static educational content, not user-specific data.
const DAILY_FACTS = [
  'Did you know? The sound of a clap made at the entrance of the Gol Gumbaz can be heard on the other side of the dome due to its whispering gallery.',
  'The Konark Sun Temple was shaped like a colossal chariot with 24 wheels, each 12 feet in diameter, pulled by seven horses.',
  "The Ajanta Caves hold some of the oldest paintings in India, dating back to the 2nd century BCE, depicting Buddha's previous lives.",
];

// Map a place's first category to a relevant stock image on Unsplash.
// This is a temporary measure until the backend supplies its own images.
const CATEGORY_IMAGE_MAP: Record<string, string> = {
  temple:
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  religious:
    'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
  fort: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
  castle:
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=800&q=80',
};
const FALLBACK_PLACE_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80';

/** Returns a representative image URI for a place based on its categories. */
function getPlaceImage(categories: string[]): string {
  const first = categories[0]?.toLowerCase() ?? '';
  for (const [keyword, uri] of Object.entries(CATEGORY_IMAGE_MAP)) {
    if (first.includes(keyword)) {
      return uri;
    }
  }
  return FALLBACK_PLACE_IMAGE;
}

type Props = TabScreenProps<'Home'>;

const Home = ({ navigation }: Props) => {
  // Trigger a permission check whenever this screen is active
  usePermissionCheck();

  const { nearbyPlaces, isLoadingNearby, nearbyError } = usePlaces();
  const { profile } = useUser();

  const [factIndex, setFactIndex] = useState(0);
  const [factVisible, setFactVisible] = useState(true);

  // Greeting changes based on time of day and is recalculated only once per
  // mount (the hour won't change while the user reads the screen)
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const currentFact = DAILY_FACTS[factIndex % DAILY_FACTS.length];

  const handleNextFact = () => {
    setFactIndex(prev => (prev + 1) % DAILY_FACTS.length);
    setFactVisible(true);
  };

  // Build the SiteDetail navigation param from a Place API object.
  // All fields the SiteDetail screen needs are derived here so the screen
  // itself never has to reach back into the raw API shape.
  const handleVisitPlace = (place: Place) => {
    const siteData = {
      id: place.id,
      name: place.name,
      location: place.formatted || `${place.city}, ${place.country}`,
      era: place.categories[0] || 'Historic',
      style: place.categories.join(', ') || 'Architecture',
      yearBuilt: 'Unknown',
      distance: `${(place.distance_meters / 1000).toFixed(1)} km`,
      estimatedTime: '45 min',
      // Placeholder hero images until the backend provides its own CDN URLs
      heroImages: [getPlaceImage(place.categories)],
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

  const renderPlaceCard = ({ item: place }: { item: Place }) => {
    const imageUri = getPlaceImage(place.categories);
    const distanceKm = (place.distance_meters / 1000).toFixed(1);
    const shortDescription = place.categories[0] || 'Historic site';

    return (
      <ImageBackground
        source={{ uri: imageUri }}
        style={{ width: 220, height: 260, marginRight: 16 }}
        imageStyle={{ borderRadius: 28 }}
      >
        <TouchableOpacity
          className="flex-1 justify-between rounded-[28px] p-4 bg-black/45"
          onPress={() => handleVisitPlace(place)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Visit ${place.name}, ${distanceKm} km away`}
          accessibilityHint="Opens the site details screen"
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
              <ArrowRight color="#000000" size={16} className="ml-2" />
            </View>
          </View>
        </TouchableOpacity>
      </ImageBackground>
    );
  };

  const userName = profile?.name || 'Explorer';

  return (
    <SafeAreaView className="flex-1 bg-[#070709]">
      <StatusBar barStyle="light-content" />

      {/* Top Greeting Bar */}
      <View
        className="flex-row items-center justify-between mt-4 mb-6 px-5"
        accessibilityRole="header"
      >
        <View className="flex-1 pr-4">
          <Text className="text-[#BEBEC2] text-sm font-montserrat-medium uppercase tracking-widest">
            {greeting},
          </Text>
          <Text className="text-white text-3xl font-montserrat-bold mt-1">
            {userName}
          </Text>
          <Text className="text-[#8D8D92] text-base font-montserrat-medium mt-1">
            Ready to unlock a new monument?
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            className="w-11 h-11 rounded-full bg-[#12121A] border border-[#272730] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            accessibilityHint="Opens your notification centre"
          >
            <Bell color="#FFFFFF" size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Nearby Places Section */}
      <View className="mb-4 px-5">
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
      ) : !nearbyPlaces || nearbyPlaces.length === 0 ? (
        <View className="h-64 items-center justify-center px-5">
          <MapPin color="#FF7A18" size={48} />
          <Text className="text-white text-lg font-montserrat-semibold mt-4">
            No nearby places found
          </Text>
          <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-2 text-center px-8">
            Try moving to a different location or check your permissions
          </Text>
        </View>
      ) : (
        // FlatList provides virtualisation so this list stays performant even
        // if the API returns a large number of places.
        <FlatList
          horizontal
          data={nearbyPlaces.slice(0, 20)}
          renderItem={renderPlaceCard}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 12 }}
          style={{ marginBottom: 0 }}
        />
      )}

      {/* Daily Fact Card */}
      {factVisible && (
        <View className="bg-[#14141D] rounded-[30px] mt-8 mx-5 p-6 border border-[#232330]">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-montserrat-semibold">
              Daily Fact
            </Text>
            <TouchableOpacity
              onPress={() => setFactVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss daily fact"
            >
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
              accessibilityRole="button"
              accessibilityLabel="Show next fact"
            >
              <Text className="text-[#FF7A18] text-sm font-montserrat-semibold mr-2">
                Next Tip
              </Text>
              <ArrowRight color="#FF7A18" size={18} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default Home;
