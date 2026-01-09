import React, { useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Modal,
  LayoutAnimation,
  UIManager,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  MapPin,
  Share2,
  Trash2,
  Play,
  Filter,
  X,
  Camera,
  Bookmark,
} from 'lucide-react-native';
import { usePlaces } from '../../context';

const SAVED_PLACES = [
  {
    id: 'saved-1',
    name: 'Humayun’s Tomb',
    location: 'Delhi, India',
    era: 'Mughal',
    type: 'Architecture',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    description:
      'A UNESCO heritage site built in 1570. Considered the earliest example of Mughal garden-tomb style.',
  },
  {
    id: 'saved-2',
    name: 'Charminar',
    location: 'Hyderabad, India',
    era: 'Deccan Sultanate',
    type: 'Monument',
    image:
      'https://images.unsplash.com/photo-1489493585363-d69421e0edd3?auto=format&fit=crop&w=900&q=80',
    description:
      'Iconic mosque and monument built in 1591 with four grand minarets framing the skyline.',
  },
  {
    id: 'saved-3',
    name: 'Gateway of India',
    location: 'Mumbai, India',
    era: 'Colonial',
    type: 'Harbor Landmark',
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
    description:
      'Commemorative arch built in 1924 overlooking the Arabian Sea, symbolizing Mumbai’s maritime legacy.',
  },
];

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Saved = ({ navigation }: any) => {
  const {
    savedPlaces,
    isLoadingSaved,
    savedError,
    refreshSavedPlaces,
    toggleSavePlace,
  } = usePlaces();

  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedPlace, setSelectedPlace] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Extract unique categories from saved places
  const categories = useMemo(() => {
    const cats = new Set<string>();
    savedPlaces.forEach(saved => {
      saved.place_data.categories.forEach(cat => cats.add(cat));
    });
    return ['All', ...Array.from(cats)];
  }, [savedPlaces]);

  const filteredPlaces = useMemo(() => {
    if (activeFilter === 'All') return savedPlaces;
    return savedPlaces.filter(saved =>
      saved.place_data.categories.includes(activeFilter),
    );
  }, [activeFilter, savedPlaces]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSavedPlaces();
    setRefreshing(false);
  };

  const handleRemove = async (placeId: string) => {
    setRemovingId(placeId);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const success = await toggleSavePlace(placeId);

    if (selectedPlace?.place_id === placeId) {
      setSelectedPlace(null);
    }

    setRemovingId(null);
  };

  const handleLaunchPlace = (saved: any) => {
    const place = saved.place_data;
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

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center mt-12">
      <View className="w-44 h-44 rounded-full bg-[#171726] items-center justify-center mb-6">
        <Bookmark color="#FF7A18" size={48} />
      </View>
      <Text className="text-white text-2xl font-montserrat-bold text-center mb-3">
        No Saved Places Yet
      </Text>
      <Text className="text-[#9A9AAF] text-base font-montserrat-medium text-center px-8 mb-6">
        Discover your first monument and tap the bookmark icon to build your
        archive.
      </Text>
      <TouchableOpacity
        className="bg-[#FF7A18] rounded-full px-8 py-3"
        onPress={() => navigation.navigate('Home')}
      >
        <Text className="text-white text-base font-montserrat-semibold">
          Explore Nearby Sites
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#070709]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF7A18"
            colors={['#FF7A18']}
          />
        }
      >
        <View className="flex-row items-center justify-between mt-6 mb-4">
          <View>
            <Text className="text-[#7E7E8F] text-sm font-montserrat-bold uppercase tracking-[4px]">
              Library
            </Text>
            <Text className="text-white text-3xl font-montserrat-bold mt-2">
              Saved Places
            </Text>
            <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-1">
              {savedPlaces.length}{' '}
              {savedPlaces.length === 1 ? 'place' : 'places'} saved
            </Text>
          </View>
        </View>

        {savedError && (
          <View className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
            <Text className="text-red-400 text-sm font-montserrat-medium">
              {savedError}
            </Text>
          </View>
        )}

        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 10 }}
          >
            {categories.map(filter => (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                className={`mr-3 px-4 py-2 rounded-full border ${
                  activeFilter === filter
                    ? 'bg-[#FF7A18] border-[#FF7A18]'
                    : 'border-[#2A2A36]'
                }`}
              >
                <Text
                  className={`text-sm font-montserrat-semibold ${
                    activeFilter === filter ? 'text-white' : 'text-[#B7B7C7]'
                  }`}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {isLoadingSaved ? (
          <View className="h-64 items-center justify-center">
            <ActivityIndicator size="large" color="#FF7A18" />
            <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-4">
              Loading saved places...
            </Text>
          </View>
        ) : filteredPlaces.length === 0 ? (
          renderEmptyState()
        ) : (
          <View className="flex-wrap flex-row justify-between">
            {filteredPlaces.map(saved => {
              const place = saved.place_data;
              const imageUri = getPlaceImage(place.categories);
              const isRemoving = removingId === place.id;

              return (
                <TouchableOpacity
                  key={saved.id}
                  onPress={() => setSelectedPlace(saved)}
                  className="w-[48%] mb-5"
                  activeOpacity={0.9}
                  disabled={isRemoving}
                >
                  <ImageBackground
                    source={{ uri: imageUri }}
                    style={{ height: 190 }}
                    imageStyle={{ borderRadius: 26 }}
                  >
                    <View className="flex-1 justify-between bg-black/35 rounded-[26px] p-4">
                      <View className="bg-white/20 rounded-full px-3 py-1 self-start">
                        <Text
                          className="text-white text-xs font-montserrat-semibold"
                          numberOfLines={1}
                        >
                          {place.categories[0] || 'Historic'}
                        </Text>
                      </View>
                      <View>
                        <Text
                          className="text-white text-[18px] font-montserrat-bold"
                          numberOfLines={2}
                        >
                          {place.name}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <MapPin color="#FFFFFF" size={16} />
                          <Text
                            className="text-white text-xs font-montserrat-medium ml-1"
                            numberOfLines={1}
                          >
                            {place.city}, {place.country}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </ImageBackground>
                  <View className="flex-row items-center justify-between mt-3">
                    <TouchableOpacity
                      className="flex-row items-center bg-[#171722] rounded-full px-3 py-2"
                      onPress={() => handleLaunchPlace(saved)}
                    >
                      <Play color="#FF7A18" size={16} />
                      <Text className="text-white text-xs font-montserrat-semibold ml-1">
                        View
                      </Text>
                    </TouchableOpacity>
                    <View className="flex-row items-center">
                      <TouchableOpacity
                        className="w-9 h-9 rounded-full bg-[#2A1111] items-center justify-center"
                        onPress={() => handleRemove(place.id)}
                        disabled={isRemoving}
                      >
                        {isRemoving ? (
                          <ActivityIndicator size="small" color="#FF6262" />
                        ) : (
                          <Trash2 color="#FF6262" size={18} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedPlace} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-[#0F0F17] rounded-t-[32px] p-6 border-t border-[#1F1F2B]">
            {selectedPlace && (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <Text
                    className="text-white text-xl font-montserrat-bold"
                    numberOfLines={2}
                    style={{ flex: 1, marginRight: 12 }}
                  >
                    {selectedPlace.place_data.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedPlace(null)}>
                    <X color="#7D7D8F" size={26} />
                  </TouchableOpacity>
                </View>
                <ImageBackground
                  source={{
                    uri: getPlaceImage(selectedPlace.place_data.categories),
                  }}
                  style={{ height: 180, borderRadius: 24, overflow: 'hidden' }}
                >
                  <View className="flex-1 bg-black/35 justify-end p-4">
                    <View className="flex-row items-center">
                      <MapPin color="#FFFFFF" size={18} />
                      <Text
                        className="text-white text-sm font-montserrat-medium ml-2"
                        numberOfLines={2}
                      >
                        {selectedPlace.place_data.formatted}
                      </Text>
                    </View>
                  </View>
                </ImageBackground>
                <View className="mt-4">
                  <Text className="text-[#7E7E8F] text-xs font-montserrat-semibold uppercase mb-2">
                    Categories
                  </Text>
                  <View className="flex-row flex-wrap">
                    {selectedPlace.place_data.categories.map(
                      (cat: string, idx: number) => (
                        <View
                          key={idx}
                          className="bg-[#171722] rounded-full px-3 py-1 mr-2 mb-2"
                        >
                          <Text className="text-[#B7B7C7] text-xs font-montserrat-medium">
                            {cat}
                          </Text>
                        </View>
                      ),
                    )}
                  </View>
                </View>
                <View className="flex-row items-center justify-between mt-6">
                  <TouchableOpacity
                    className="flex-row items-center bg-[#FF7A18] rounded-2xl px-4 py-3 flex-1"
                    onPress={() => {
                      setSelectedPlace(null);
                      handleLaunchPlace(selectedPlace);
                    }}
                  >
                    <Camera color="#FFFFFF" size={18} />
                    <Text className="text-white text-base font-montserrat-semibold ml-2">
                      View Details
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Saved;
