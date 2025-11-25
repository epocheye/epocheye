import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import {
  MapPin,
  Share2,
  Trash2,
  Play,
  Filter,
  X,
  Camera,
} from 'lucide-react-native';

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

const SAVED_FILTERS = ['All', 'Mughal', 'Deccan Sultanate', 'Colonial'];

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Saved = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedPlace, setSelectedPlace] = useState<
    (typeof SAVED_PLACES)[0] | null
  >(null);
  const [savedPlaces, setSavedPlaces] = useState(SAVED_PLACES);

  const filteredPlaces = useMemo(() => {
    if (activeFilter === 'All') return savedPlaces;
    return savedPlaces.filter(place => place.era === activeFilter);
  }, [activeFilter, savedPlaces]);

  const handleRemove = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSavedPlaces(prev => prev.filter(place => place.id !== id));
    if (selectedPlace?.id === id) {
      setSelectedPlace(null);
    }
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center mt-12">
      <View className="w-44 h-44 rounded-full bg-[#171726] items-center justify-center mb-6">
        <Camera color="#FF7A18" size={48} />
      </View>
      <Text className="text-white text-2xl font-montserrat-bold text-center mb-3">
        No Saved Places Yet
      </Text>
      <Text className="text-[#9A9AAF] text-base font-montserrat-medium text-center px-8 mb-6">
        Discover your first monument and tap the save icon to build your
        archive.
      </Text>
      <TouchableOpacity className="bg-[#FF7A18] rounded-full px-8 py-3">
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
      >
        <View className="flex-row items-center justify-between mt-6 mb-4">
          <View>
            <Text className="text-[#7E7E8F] text-sm font-montserrat-bold uppercase tracking-[4px]">
              Library
            </Text>
            <Text className="text-white text-3xl font-montserrat-bold mt-2">
              Saved Places
            </Text>
          </View>
          <TouchableOpacity className="w-11 h-11 rounded-full border border-[#2A2A36] items-center justify-center">
            <Filter color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 10 }}
        >
          {SAVED_FILTERS.map(filter => (
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

        {filteredPlaces.length === 0 ? (
          renderEmptyState()
        ) : (
          <View className="flex-wrap flex-row justify-between">
            {filteredPlaces.map(place => (
              <TouchableOpacity
                key={place.id}
                onPress={() => setSelectedPlace(place)}
                className="w-[48%] mb-5"
                activeOpacity={0.9}
              >
                <ImageBackground
                  source={{ uri: place.image }}
                  style={{ height: 190 }}
                  imageStyle={{ borderRadius: 26 }}
                >
                  <View className="flex-1 justify-between bg-black/35 rounded-[26px] p-4">
                    <View className="bg-white/20 rounded-full px-3 py-1 self-start">
                      <Text className="text-white text-xs font-montserrat-semibold">
                        {place.era}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-white text-[18px] font-montserrat-bold">
                        {place.name}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <MapPin color="#FFFFFF" size={16} />
                        <Text className="text-white text-xs font-montserrat-medium ml-1">
                          {place.location}
                        </Text>
                      </View>
                    </View>
                  </View>
                </ImageBackground>
                <View className="flex-row items-center justify-between mt-3">
                  <TouchableOpacity className="flex-row items-center bg-[#171722] rounded-full px-3 py-2">
                    <Play color="#FF7A18" size={16} />
                    <Text className="text-white text-xs font-montserrat-semibold ml-1">
                      Launch
                    </Text>
                  </TouchableOpacity>
                  <View className="flex-row items-center">
                    <TouchableOpacity className="w-9 h-9 rounded-full bg-[#151522] items-center justify-center mr-2">
                      <Share2 color="#B7B7C7" size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="w-9 h-9 rounded-full bg-[#2A1111] items-center justify-center"
                      onPress={() => handleRemove(place.id)}
                    >
                      <Trash2 color="#FF6262" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedPlace} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-[#0F0F17] rounded-t-[32px] p-6 border-t border-[#1F1F2B]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-xl font-montserrat-bold">
                {selectedPlace?.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedPlace(null)}>
                <X color="#7D7D8F" size={26} />
              </TouchableOpacity>
            </View>
            <ImageBackground
              source={{ uri: selectedPlace?.image }}
              style={{ height: 180, borderRadius: 24, overflow: 'hidden' }}
            >
              <View className="flex-1 bg-black/35 justify-end p-4">
                <View className="flex-row items-center">
                  <MapPin color="#FFFFFF" size={18} />
                  <Text className="text-white text-sm font-montserrat-medium ml-2">
                    {selectedPlace?.location}
                  </Text>
                </View>
              </View>
            </ImageBackground>
            <Text className="text-[#CBCBD9] text-base font-montserrat-regular leading-6 mt-4">
              {selectedPlace?.description}
            </Text>
            <View className="flex-row items-center justify-between mt-6">
              <TouchableOpacity className="flex-row items-center bg-[#17172A] rounded-2xl px-4 py-3 flex-1 mr-3">
                <Share2 color="#FFFFFF" size={18} />
                <Text className="text-white text-base font-montserrat-semibold ml-2">
                  Share Story
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-row items-center bg-[#FF7A18] rounded-2xl px-4 py-3 flex-1">
                <Camera color="#FFFFFF" size={18} />
                <Text className="text-white text-base font-montserrat-semibold ml-2">
                  Launch AR
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Saved;
