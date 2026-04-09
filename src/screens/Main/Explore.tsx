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
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ArrowRight, Compass, MapPin, Search, X } from 'lucide-react-native';
import { usePlaces } from '../../context';
import { useDebounce } from '../../shared/hooks';
import type { TabScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';
import type { Place } from '../../utils/api/places/types';
import { buildSiteDetailData, getPlaceImage } from '../../shared/utils';

// ─── constants ────────────────────────────────────────────────────────────────


// ─── ExploreCard ──────────────────────────────────────────────────────────────

interface ExploreCardProps {
  place: Place;
  onPress: (place: Place) => void;
}

const ExploreCard: React.FC<ExploreCardProps> = React.memo(
  ({ place, onPress }) => {
    const scale = useSharedValue(1);
    const fallbackUri = getPlaceImage(place.categories);
    const distanceKm = (place.distance_meters / 1000).toFixed(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Animated.View style={[exploreCardStyles.container, animatedStyle]}>
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
            style={exploreCardStyles.image}
            imageStyle={exploreCardStyles.imageMask}
          >
            <LinearGradient
              colors={['rgba(8,8,8,0.05)', 'rgba(8,8,8,0.9)']}
              style={exploreCardStyles.gradient}
            >
              <View className="self-start flex-row items-center gap-1 rounded-full bg-[rgba(10,10,10,0.8)] border border-[rgba(201,168,76,0.35)] px-2 py-1">
                <Compass color="#C9A84C" size={11} />
                <Text className="text-[#F5F0E8] text-[10px] font-['MontserratAlternates-SemiBold']">
                  {distanceKm} km
                </Text>
              </View>

              <View>
                <Text
                  className="text-[#F5F0E8] text-base font-['MontserratAlternates-Bold'] leading-5"
                  numberOfLines={2}
                >
                  {place.name}
                </Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <MapPin color="#B8AF9E" size={11} />
                  <Text
                    className="text-[#B8AF9E] text-[11px] font-['MontserratAlternates-Medium'] flex-shrink"
                    numberOfLines={1}
                  >
                    {place.city}
                  </Text>
                </View>
                <View className="mt-3 self-start flex-row items-center gap-1 rounded-full bg-[#C9A84C] px-2.5 py-1.5">
                  <Text className="text-[#0A0A0A] text-[10px] uppercase tracking-[0.6px] font-['MontserratAlternates-SemiBold']">
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
    <Animated.View style={[skeletonStyles.card, animatedStyle]}>
      <View style={skeletonStyles.pill} />
      <View style={skeletonStyles.title} />
      <View style={skeletonStyles.line} />
      <View style={skeletonStyles.cta} />
    </Animated.View>
  );
};

// ─── Category / Region chips ──────────────────────────────────────────────────

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
        ? 'bg-[#C9A84C] border-[#C9A84C]'
        : 'bg-transparent border-[rgba(201,168,76,0.3)]'
    }`}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
  >
    <Text
      className={`text-xs font-['MontserratAlternates-SemiBold'] ${
        active ? 'text-[#0A0A0A]' : 'text-[#B8AF9E]'
      }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Props = TabScreenProps<'Explore'>;

const Explore: React.FC<Props> = ({ navigation }) => {
  const nearbyPlaces = usePlaces(state => state.nearbyPlaces);
  const isLoadingNearby = usePlaces(state => state.isLoadingNearby);
  const ensureLocationTracking = usePlaces(state => state.ensureLocationTracking);
  const [searchText, setSearchText] = useState('');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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

  // Derive unique regions and categories from nearby places.
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

  // Filter places by search + region + category.
  const filteredPlaces = useMemo(() => {
    return (nearbyPlaces || []).filter(place => {
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
  }, [nearbyPlaces, debouncedSearch, activeRegion, activeCategory]);

  const handleCardPress = useCallback(
    (place: Place) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: buildSiteDetailData(place),
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Place }) => (
      <ExploreCard place={item} onPress={handleCardPress} />
    ),
    [handleCardPress],
  );

  const keyExtractor = useCallback((item: Place) => item.id, []);

  const hasActiveFilter = !!(searchText || activeRegion || activeCategory);

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0A', '#14110B', '#0A0A0A']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        <Animated.View className="flex-1" style={containerStyle}>
          {/* Header */}
          <View className="px-5 pt-5 pb-3">
            <Text className="font-['MontserratAlternates-SemiBold'] text-xs uppercase tracking-[1px] text-[#C9A84C]">
              DISCOVER
            </Text>
            <Text className="mt-1 font-['MontserratAlternates-Bold'] text-[26px] leading-9 text-[#F5F0E8]">
              Explore Places
            </Text>
          </View>

          {/* Search bar */}
          <View className="mx-5 mb-3 flex-row items-center bg-[#141414] border border-[rgba(255,255,255,0.1)] rounded-2xl px-3 py-2.5">
            <Search color="#6B6357" size={18} />
            <TextInput
              ref={searchRef}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search heritage sites..."
              placeholderTextColor="#6B6357"
              className="flex-1 ml-2.5 text-[#F5F0E8] text-sm font-['MontserratAlternates-Regular']"
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

          {/* Clear filters hint */}
          {hasActiveFilter && (
            <TouchableOpacity
              className="mx-5 mb-3 self-start"
              onPress={() => {
                setSearchText('');
                setActiveRegion(null);
                setActiveCategory(null);
              }}
            >
              <Text className="text-[#C9A84C] text-xs font-['MontserratAlternates-Medium']">
                Clear filters
              </Text>
            </TouchableOpacity>
          )}

          {/* Results count */}
          <View className="mx-5 mb-3 flex-row items-center justify-between">
            <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular']">
              {isLoadingNearby
                ? 'Loading...'
                : `${filteredPlaces.length} site${filteredPlaces.length !== 1 ? 's' : ''} found`}
            </Text>
          </View>

          {/* Place grid */}
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
              <Text className="mt-4 text-[#F5F0E8] text-lg text-center font-['MontserratAlternates-SemiBold']">
                No places found
              </Text>
              <Text className="mt-2 text-[#B8AF9E] text-sm text-center font-['MontserratAlternates-Regular']">
                {hasActiveFilter
                  ? 'Try adjusting your filters or search term.'
                  : 'Move closer to a heritage site or enable location access.'}
              </Text>
            </View>
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

// ─── styles ───────────────────────────────────────────────────────────────────

const exploreCardStyles = {
  container: {
    flex: 1,
  },
  image: {
    height: 220,
  },
  imageMask: {
    borderRadius: 16,
  },
  gradient: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    justifyContent: 'space-between' as const,
  },
};

const skeletonStyles = {
  card: {
    flex: 1,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    justifyContent: 'flex-end' as const,
  },
  pill: {
    width: 64,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  title: {
    width: '75%' as const,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: 8,
  },
  line: {
    width: '55%' as const,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10,
  },
  cta: {
    width: 72,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(201,168,76,0.22)',
  },
};
