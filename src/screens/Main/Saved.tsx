import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  LayoutAnimation,
  UIManager,
  Platform,
  RefreshControl,
} from 'react-native';
import { MapPin, Trash2, Play, X, Camera, Bookmark } from 'lucide-react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import ResolvedSubjectImage from '../../components/ui/ResolvedSubjectImage';
import { usePlaces } from '../../context';
import type { TabScreenProps } from '../../core/types/navigation.types';
import type { SavedPlace } from '../../utils/api/places/types';
import { buildSiteDetailData, getPlaceImage } from '../../shared/utils';

// Enable LayoutAnimation on Android so card removal is animated.
// Must be called at module level before the component is rendered.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = TabScreenProps<'Saved'>;

const Saved = ({ navigation }: Props) => {
  const savedPlaces = usePlaces(state => state.savedPlaces);
  const isLoadingSaved = usePlaces(state => state.isLoadingSaved);
  const savedError = usePlaces(state => state.savedError);
  const refreshSavedPlaces = usePlaces(state => state.refreshSavedPlaces);
  const ensureSavedPlacesLoaded = usePlaces(
    state => state.ensureSavedPlacesLoaded,
  );
  const toggleSavePlace = usePlaces(state => state.toggleSavePlace);

  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedPlace, setSelectedPlace] = useState<SavedPlace | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    void ensureSavedPlacesLoaded();
  }, [ensureSavedPlacesLoaded]);

  // Filter out entries that lack a valid place_data shape. The API normalises
  // this in getSavedPlaces(), but we defend here as an extra guard.
  const safeSavedPlaces = useMemo(
    () =>
      (savedPlaces || []).filter(
        saved =>
          !!saved?.place_data && Array.isArray(saved.place_data.categories),
      ),
    [savedPlaces],
  );

  // Build the list of category filter chips from the actual saved places data
  const categories = useMemo(() => {
    const cats = new Set<string>();
    safeSavedPlaces.forEach(saved => {
      saved.place_data.categories.forEach(cat => cats.add(cat));
    });
    return ['All', ...Array.from(cats)];
  }, [safeSavedPlaces]);

  const filteredPlaces = useMemo(() => {
    if (activeFilter === 'All') return safeSavedPlaces;
    return safeSavedPlaces.filter(saved =>
      saved.place_data.categories.includes(activeFilter),
    );
  }, [activeFilter, safeSavedPlaces]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSavedPlaces();
    setRefreshing(false);
  };

  const handleRemove = async (placeId: string) => {
    setRemovingId(placeId);
    // Animate the card disappearing so the UI feels responsive
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    await toggleSavePlace(placeId);

    if (selectedPlace?.place_id === placeId) {
      setSelectedPlace(null);
    }
    setRemovingId(null);
  };

  const handleLaunchPlace = (saved: SavedPlace) => {
    navigation.navigate('SiteDetail', {
      site: buildSiteDetailData(saved.place_data),
    });
  };

  const renderPlaceCard = ({ item: saved }: { item: SavedPlace }) => {
    const place = saved.place_data;
    const imageUri = getPlaceImage(place.categories);
    const isRemoving = removingId === place.id;

    return (
      <TouchableOpacity
        onPress={() => setSelectedPlace(saved)}
        className="w-[48%] mb-5"
        activeOpacity={0.9}
        disabled={isRemoving}
        accessibilityRole="button"
        accessibilityLabel={`Saved place: ${place.name}`}
        accessibilityHint="Opens place details"
      >
        <ResolvedSubjectImage
          subject={place.name}
          context={`${place.city} ${place.country} ${place.categories.join(
            ', ',
          )}`}
          fallbackUri={imageUri}
          style={{ height: 190, borderRadius: 26 }}
          imageStyle={{ borderRadius: 26 }}
          loadingLabel="Loading place visual..."
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
        </ResolvedSubjectImage>
        <View className="flex-row items-center justify-between mt-3">
          <TouchableOpacity
            className="flex-row items-center bg-[#171722] rounded-full px-3 py-2"
            onPress={() => handleLaunchPlace(saved)}
            accessibilityRole="button"
            accessibilityLabel={`View details for ${place.name}`}
          >
            <Play color="#FF7A18" size={16} />
            <Text className="text-white text-xs font-montserrat-semibold ml-1">
              View
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-[#2A1111] items-center justify-center"
            onPress={() => handleRemove(place.id)}
            disabled={isRemoving}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${place.name} from saved places`}
          >
            {isRemoving ? (
              <AnimatedLogo
                size={16}
                variant="white"
                motion="pulse"
                showRing={false}
              />
            ) : (
              <Trash2 color="#FF6262" size={18} />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Rendered above the grid in the FlatList, keeping the
  // header, error banner, and filter chips scroll-linked to the list.
  const ListHeader = () => (
    <>
      <View className="flex-row items-center justify-between mt-6 mb-4">
        <View>
          <Text className="text-[#7E7E8F] text-sm font-montserrat-bold uppercase tracking-[4px]">
            Library
          </Text>
          <Text className="text-white text-3xl font-montserrat-bold mt-2">
            Saved Places
          </Text>
          <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-1">
            {safeSavedPlaces.length}{' '}
            {safeSavedPlaces.length === 1 ? 'place' : 'places'} saved
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
        <FlatList
          horizontal
          data={categories}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 10 }}
          renderItem={({ item: filter }) => (
            <TouchableOpacity
              onPress={() => setActiveFilter(filter)}
              className={`mr-3 px-4 py-2 rounded-full border ${
                activeFilter === filter
                  ? 'bg-[#FF7A18] border-[#FF7A18]'
                  : 'border-[#2A2A36]'
              }`}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${filter}`}
              accessibilityState={{ selected: activeFilter === filter }}
            >
              <Text
                className={`text-sm font-montserrat-semibold ${
                  activeFilter === filter ? 'text-white' : 'text-[#B7B7C7]'
                }`}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {isLoadingSaved && (
        <View className="h-64 items-center justify-center">
          <AnimatedLogo size={58} variant="white" motion="orbit" />
          <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-4">
            Loading saved places...
          </Text>
        </View>
      )}
    </>
  );

  const EmptyState = () => (
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
        accessibilityRole="button"
        accessibilityLabel="Explore nearby sites"
      >
        <Text className="text-white text-base font-montserrat-semibold">
          Explore Nearby Sites
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#070709]">
      {/* FlatList with numColumns provides a virtualised 2-column grid,
          keeping memory usage constant regardless of how many places are saved. */}
      <FlatList
        data={isLoadingSaved ? [] : filteredPlaces}
        renderItem={renderPlaceCard}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 32,
        }}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={!isLoadingSaved ? <EmptyState /> : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF7A18"
            colors={['#FF7A18']}
          />
        }
      />

      {/* Bottom sheet modal for place detail preview */}
      <Modal
        visible={!!selectedPlace}
        transparent
        animationType="slide"
        accessibilityViewIsModal={true}
      >
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
                  <TouchableOpacity
                    onPress={() => setSelectedPlace(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close preview"
                  >
                    <X color="#7D7D8F" size={26} />
                  </TouchableOpacity>
                </View>
                <ResolvedSubjectImage
                  subject={selectedPlace.place_data.name}
                  context={`${selectedPlace.place_data.city} ${selectedPlace.place_data.country}`}
                  fallbackUri={getPlaceImage(
                    selectedPlace.place_data.categories,
                  )}
                  style={{ height: 180, borderRadius: 24, overflow: 'hidden' }}
                  imageStyle={{ borderRadius: 24 }}
                  loadingLabel="Loading place visual..."
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
                </ResolvedSubjectImage>
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
                    accessibilityRole="button"
                    accessibilityLabel={`Open full details for ${selectedPlace.place_data.name}`}
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
