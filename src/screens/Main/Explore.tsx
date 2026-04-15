import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowRight,
  ArrowUpDown,
  Compass,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  X,
} from 'lucide-react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { GOOGLE_MAPS_API_KEY } from '@env';
import mapStyle from '../../content/mapstyle.json';
import { usePlaces } from '../../context';
import { useDebounce } from '../../shared/hooks';
import type { TabScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';
import type { Place } from '../../utils/api/places/types';
import { buildSiteDetailData, getPlaceImage } from '../../shared/utils';

// ─── ExploreCard ──────────────────────────────────────────────────────────────

interface ExploreCardProps {
  place: Place;
  index: number;
  onPress: (place: Place) => void;
}

const ExploreCard: React.FC<ExploreCardProps> = React.memo(
  ({ place, index, onPress }) => {
    const scale = useSharedValue(1);
    const fallbackUri = getPlaceImage(place.categories);
    const distanceKm = (place.distance_meters / 1000).toFixed(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(350)}
        style={[{ flex: 1 }, animatedStyle]}
      >
        <TouchableOpacity
          onPress={() => onPress(place)}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
          }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Visit ${place.name}`}
        >
          <ImageBackground
            source={{ uri: fallbackUri }}
            style={{ height: 220 }}
            imageStyle={{ borderRadius: 16 }}
          >
            <LinearGradient
              colors={['rgba(8,8,8,0.05)', 'rgba(8,8,8,0.9)']}
              style={{
                flex: 1,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                padding: 12,
                justifyContent: 'space-between',
              }}
            >
              <View className="self-start flex-row items-center gap-1 rounded-full bg-[rgba(10,10,10,0.8)] border border-[rgba(201,168,76,0.35)] px-2 py-1">
                <Compass color="#C9A84C" size={11} />
                <Text className="text-parchment text-[10px] font-['MontserratAlternates-SemiBold']">
                  {distanceKm} km
                </Text>
              </View>

              <View>
                <Text
                  className="text-parchment text-base font-['MontserratAlternates-Bold'] leading-5"
                  numberOfLines={2}
                >
                  {place.name}
                </Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <MapPin color="#B8AF9E" size={11} />
                  <Text
                    className="text-parchment-muted text-[11px] font-['MontserratAlternates-Medium'] flex-shrink"
                    numberOfLines={1}
                  >
                    {place.city}
                  </Text>
                </View>
                <View className="mt-3 self-start flex-row items-center gap-1 rounded-full bg-brand-gold px-2.5 py-1.5">
                  <Text className="text-ink text-[10px] uppercase tracking-[0.6px] font-['MontserratAlternates-SemiBold']">
                    Explore
                  </Text>
                  <ArrowRight color="#0A0A0A" size={11} />
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);
ExploreCard.displayName = 'ExploreCard';

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={animatedStyle}
      className="flex-1 h-[220px] rounded-2xl bg-surface-1 border border-white/[0.08] p-3 justify-end"
    >
      <View className="w-16 h-5 rounded-full bg-white/10 mb-2.5" />
      <View className="w-3/4 h-[22px] rounded-md bg-white/[0.14] mb-2" />
      <View className="w-[55%] h-3 rounded-md bg-white/10 mb-2.5" />
      <View className="w-[72px] h-[26px] rounded-full bg-[rgba(201,168,76,0.22)]" />
    </Animated.View>
  );
};

// ─── Filter Chip ──────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    className={`mr-2 px-3 py-1.5 rounded-full border ${
      active
        ? 'bg-brand-gold border-brand-gold'
        : 'bg-transparent border-[rgba(201,168,76,0.3)]'
    }`}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
  >
    <Text
      className={`text-xs font-['MontserratAlternates-SemiBold'] ${
        active ? 'text-ink' : 'text-parchment-muted'
      }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortMode = 'distance' | 'name';

// ─── Map View ─────────────────────────────────────────────────────────────────

interface PlaceMapViewProps {
  places: Place[];
  onPlacePress: (place: Place) => void;
}

const PlaceMapView: React.FC<PlaceMapViewProps> = React.memo(
  ({ places, onPlacePress }) => {
    const mapRef = useRef<MapView>(null);

    const initialRegion: Region = useMemo(() => {
      if (places.length > 0) {
        const lats = places.map(p => p.lat);
        const lons = places.map(p => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        return {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(maxLat - minLat, 0.02) * 1.5,
          longitudeDelta: Math.max(maxLon - minLon, 0.02) * 1.5,
        };
      }
      return {
        latitude: 28.6139,
        longitude: 77.209,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }, [places]);

    return (
      <Animated.View
        entering={FadeInDown.duration(350)}
        className="flex-1 mx-5 rounded-2xl overflow-hidden border border-white/10"
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          customMapStyle={mapStyle}
          showsUserLocation
          showsMyLocationButton
          loadingEnabled
          // @ts-expect-error Prop exists on native MapView but missing from type defs
          googleMapsApiKey={GOOGLE_MAPS_API_KEY?.trim()}
        >
          {places.map(place => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lon }}
              title={place.name}
              description={`${place.city} · ${(place.distance_meters / 1000).toFixed(1)} km`}
              pinColor="#D4860A"
              onCalloutPress={() => onPlacePress(place)}
            />
          ))}
        </MapView>
      </Animated.View>
    );
  },
);
PlaceMapView.displayName = 'PlaceMapView';

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Props = TabScreenProps<'Explore'>;

const Explore: React.FC<Props> = ({ navigation }) => {
  const nearbyPlaces = usePlaces(state => state.nearbyPlaces);
  const isLoadingNearby = usePlaces(state => state.isLoadingNearby);
  const ensureLocationTracking = usePlaces(state => state.ensureLocationTracking);
  const [searchText, setSearchText] = useState('');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('distance');
  const debouncedSearch = useDebounce(searchText, 300);
  const searchRef = useRef<TextInput>(null);

  const fadeIn = useSharedValue(0);
  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 350 });
  }, [fadeIn]);
  const containerStyle = useAnimatedStyle(() => ({ opacity: fadeIn.value }));

  useEffect(() => {
    void ensureLocationTracking();
  }, [ensureLocationTracking]);

  // Derive unique regions from nearby places
  const regions = useMemo(() => {
    const seen = new Set<string>();
    return (nearbyPlaces || [])
      .map(p => p.city)
      .filter(c => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
      })
      .slice(0, 6);
  }, [nearbyPlaces]);

  // Derive unique categories from nearby places
  const categories = useMemo(() => {
    const seen = new Set<string>();
    return (nearbyPlaces || [])
      .flatMap(p => p.categories)
      .map(c => c.toLowerCase())
      .filter(c => {
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return true;
      })
      .slice(0, 6);
  }, [nearbyPlaces]);

  // Filter and sort places
  const filteredPlaces = useMemo(() => {
    const filtered = (nearbyPlaces || []).filter(place => {
      const matchesSearch = debouncedSearch
        ? place.name.toLowerCase().includes(debouncedSearch.toLowerCase())
        : true;
      const matchesRegion = activeRegion
        ? place.city?.toLowerCase() === activeRegion.toLowerCase()
        : true;
      const matchesCategory = activeCategory
        ? place.categories.some(c =>
            c.toLowerCase().includes(activeCategory.toLowerCase()),
          )
        : true;
      return matchesSearch && matchesRegion && matchesCategory;
    });

    if (sortMode === 'name') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    // 'distance' — already sorted by distance from API
    return filtered;
  }, [nearbyPlaces, debouncedSearch, activeRegion, activeCategory, sortMode]);

  const handleCardPress = useCallback(
    (place: Place) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: buildSiteDetailData(place),
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Place; index: number }) => (
      <ExploreCard place={item} index={index} onPress={handleCardPress} />
    ),
    [handleCardPress],
  );

  const keyExtractor = useCallback((item: Place) => item.id, []);

  const hasActiveFilter = !!(searchText || activeRegion || activeCategory);

  const toggleSort = useCallback(() => {
    setSortMode(prev => (prev === 'distance' ? 'name' : 'distance'));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-ink-deep">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#000000', '#0C0A07', '#000000']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        <Animated.View className="flex-1" style={containerStyle}>
          {/* Header */}
          <View className="px-5 pt-5 pb-3 flex-row items-end justify-between">
            <View>
              <Text className="font-['MontserratAlternates-SemiBold'] text-xs uppercase tracking-[1px] text-brand-gold">
                DISCOVER
              </Text>
              <Text className="mt-1 font-['MontserratAlternates-Bold'] text-[26px] leading-9 text-parchment">
                Explore Places
              </Text>
            </View>

            {/* View toggle */}
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={toggleSort}
                className="w-9 h-9 rounded-full bg-surface-1 border border-white/10 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${sortMode === 'distance' ? 'name' : 'distance'}`}
              >
                <ArrowUpDown color={sortMode === 'name' ? '#C9A84C' : '#6B6357'} size={16} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode(prev => (prev === 'grid' ? 'map' : 'grid'))}
                className="w-9 h-9 rounded-full bg-surface-1 border border-white/10 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={viewMode === 'grid' ? 'Switch to map view' : 'Switch to grid view'}
              >
                {viewMode === 'grid' ? (
                  <MapIcon color="#6B6357" size={16} />
                ) : (
                  <List color="#C9A84C" size={16} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar */}
          <View className="mx-5 mb-3 flex-row items-center bg-surface-1 border border-[rgba(255,255,255,0.1)] rounded-2xl px-3 py-2.5">
            <Search color="#6B6357" size={18} />
            <TextInput
              ref={searchRef}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search heritage sites..."
              placeholderTextColor="#6B6357"
              className="flex-1 ml-2.5 text-parchment text-sm font-['MontserratAlternates-Regular']"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <X color="#6B6357" size={16} />
              </TouchableOpacity>
            )}
          </View>

          {/* Region filter chips */}
          {regions.length > 0 && (
            <View className="mb-2">
              <FlatList
                horizontal
                data={['All', ...regions]}
                keyExtractor={item => `region-${item}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 4 }}
                renderItem={({ item }) => (
                  <FilterChip
                    label={item}
                    active={item === 'All' ? !activeRegion : activeRegion === item}
                    onPress={() =>
                      setActiveRegion(item === 'All' ? null : item)
                    }
                  />
                )}
              />
            </View>
          )}

          {/* Category filter chips */}
          {categories.length > 0 && (
            <View className="mb-3">
              <FlatList
                horizontal
                data={['All', ...categories]}
                keyExtractor={item => `cat-${item}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 4 }}
                renderItem={({ item }) => (
                  <FilterChip
                    label={item}
                    active={item === 'All' ? !activeCategory : activeCategory === item}
                    onPress={() =>
                      setActiveCategory(item === 'All' ? null : item)
                    }
                  />
                )}
              />
            </View>
          )}

          {/* Clear filters + results count */}
          <View className="mx-5 mb-3 flex-row items-center justify-between">
            <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular']">
              {isLoadingNearby
                ? 'Loading...'
                : `${filteredPlaces.length} site${filteredPlaces.length !== 1 ? 's' : ''} found`}
              {sortMode === 'name' ? ' · A–Z' : ' · nearest'}
            </Text>
            {hasActiveFilter && (
              <TouchableOpacity
                onPress={() => {
                  setSearchText('');
                  setActiveRegion(null);
                  setActiveCategory(null);
                }}
              >
                <Text className="text-brand-gold text-xs font-['MontserratAlternates-Medium']">
                  Clear filters
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Content area */}
          {isLoadingNearby ? (
            <View className="flex-row flex-wrap px-5 gap-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : filteredPlaces.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8 pb-16">
              <MapPin color="#C9A84C" size={40} />
              <Text className="mt-4 text-parchment text-lg text-center font-['MontserratAlternates-SemiBold']">
                No places found
              </Text>
              <Text className="mt-2 text-parchment-muted text-sm text-center font-['MontserratAlternates-Regular']">
                {hasActiveFilter
                  ? 'Try adjusting your filters or search term.'
                  : 'Move closer to a heritage site or enable location access.'}
              </Text>
            </View>
          ) : viewMode === 'map' ? (
            <PlaceMapView
              places={filteredPlaces}
              onPlacePress={handleCardPress}
            />
          ) : (
            <FlatList
              data={filteredPlaces}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              numColumns={2}
              columnWrapperStyle={{ paddingHorizontal: 20, gap: 12 }}
              contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={6}
              maxToRenderPerBatch={4}
              windowSize={5}
              removeClippedSubviews
            />
          )}
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default Explore;
