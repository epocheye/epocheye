import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowUpDown,
  Bookmark,
  Compass,
  MapPin,
  Trash2,
} from 'lucide-react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import ResolvedSubjectImage from '../../components/ui/ResolvedSubjectImage';
import { usePlaces } from '../../context';
import type { TabScreenProps } from '../../core/types/navigation.types';
import type { SavedPlace } from '../../utils/api/places/types';
import { buildSiteDetailData, getPlaceImage } from '../../shared/utils';
import { ROUTES } from '../../core/constants';

// ─── Sort modes ───────────────────────────────────────────────────────────────

type SortMode = 'date' | 'name' | 'distance';

const SORT_LABELS: Record<SortMode, string> = {
  date: 'Recent',
  name: 'A–Z',
  distance: 'Nearest',
};

const SORT_CYCLE: SortMode[] = ['date', 'name', 'distance'];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={style}
      className="flex-1 h-[200px] rounded-2xl bg-[#141414] border border-white/[0.08] p-3 justify-end"
    >
      <View className="w-16 h-5 rounded-full bg-white/10 mb-2" />
      <View className="w-3/4 h-5 rounded-md bg-white/[0.14] mb-2" />
      <View className="w-1/2 h-3 rounded-md bg-white/10" />
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

// ─── Place Card ───────────────────────────────────────────────────────────────

interface PlaceCardProps {
  saved: SavedPlace;
  index: number;
  onPress: (saved: SavedPlace) => void;
  onRemove: (placeId: string, name: string) => void;
  isRemoving: boolean;
}

const PlaceCard: React.FC<PlaceCardProps> = React.memo(
  ({ saved, index, onPress, onRemove, isRemoving }) => {
    const place = saved.place_data;
    const imageUri = getPlaceImage(place.categories);
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const distanceKm =
      place.distance_meters > 0
        ? `${(place.distance_meters / 1000).toFixed(1)} km`
        : null;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(350)}
        exiting={FadeOut.duration(250)}
        style={[{ flex: 1 }, animatedStyle]}
      >
        <TouchableOpacity
          onPress={() => onPress(saved)}
          onLongPress={() => onRemove(place.id, place.name)}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
          }}
          activeOpacity={0.9}
          disabled={isRemoving}
          accessibilityRole="button"
          accessibilityLabel={`Saved place: ${place.name}`}
          accessibilityHint="Tap to view details, long press to remove"
        >
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country} ${place.categories.join(', ')}`}
            fallbackUri={imageUri}
            style={{ height: 200, borderRadius: 16 }}
            imageStyle={{ borderRadius: 16 }}
            loadingLabel="Loading..."
          >
            <LinearGradient
              colors={['rgba(8,8,8,0.05)', 'rgba(8,8,8,0.9)']}
              className="flex-1 rounded-2xl p-3 justify-between"
              style={{ borderRadius: 16 }}
            >
              {/* Top row: category + remove */}
              <View className="flex-row items-start justify-between">
                <View className="rounded-full bg-[rgba(10,10,10,0.8)] border border-[rgba(201,168,76,0.35)] px-2 py-1">
                  <Text
                    className="text-[#F5F0E8] text-[10px] font-['MontserratAlternates-SemiBold']"
                    numberOfLines={1}
                  >
                    {place.categories[0] || 'Historic'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onRemove(place.id, place.name)}
                  disabled={isRemoving}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="w-7 h-7 rounded-full bg-[rgba(10,10,10,0.7)] border border-red-500/30 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${place.name}`}
                >
                  {isRemoving ? (
                    <AnimatedLogo
                      size={12}
                      variant="white"
                      motion="pulse"
                      showRing={false}
                    />
                  ) : (
                    <Trash2 color="#EF4444" size={13} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Bottom: name + location */}
              <View>
                <Text
                  className="text-[#F5F0E8] text-[15px] font-['MontserratAlternates-Bold'] leading-5"
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
                    {place.city}{distanceKm ? ` · ${distanceKm}` : ''}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </ResolvedSubjectImage>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);
PlaceCard.displayName = 'PlaceCard';

// ─── Screen ───────────────────────────────────────────────────────────────────

type Props = TabScreenProps<'Saved'>;

const Saved: React.FC<Props> = ({ navigation }) => {
  const savedPlaces = usePlaces(state => state.savedPlaces);
  const isLoadingSaved = usePlaces(state => state.isLoadingSaved);
  const savedError = usePlaces(state => state.savedError);
  const refreshSavedPlaces = usePlaces(state => state.refreshSavedPlaces);
  const ensureSavedPlacesLoaded = usePlaces(
    state => state.ensureSavedPlacesLoaded,
  );
  const toggleSavePlace = usePlaces(state => state.toggleSavePlace);

  const [activeFilter, setActiveFilter] = useState('All');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    void ensureSavedPlacesLoaded();
  }, [ensureSavedPlacesLoaded]);

  // Filter out entries that lack valid place_data
  const safeSavedPlaces = useMemo(
    () =>
      (savedPlaces || []).filter(
        saved =>
          !!saved?.place_data && Array.isArray(saved.place_data.categories),
      ),
    [savedPlaces],
  );

  // Category chips
  const categories = useMemo(() => {
    const cats = new Set<string>();
    safeSavedPlaces.forEach(saved => {
      saved.place_data.categories.forEach(cat => cats.add(cat));
    });
    return Array.from(cats).slice(0, 8);
  }, [safeSavedPlaces]);

  // Filter + sort
  const filteredPlaces = useMemo(() => {
    let list =
      activeFilter === 'All'
        ? safeSavedPlaces
        : safeSavedPlaces.filter(saved =>
            saved.place_data.categories.includes(activeFilter),
          );

    if (sortMode === 'name') {
      list = [...list].sort((a, b) =>
        a.place_data.name.localeCompare(b.place_data.name),
      );
    } else if (sortMode === 'distance') {
      list = [...list].sort(
        (a, b) =>
          (a.place_data.distance_meters || 0) -
          (b.place_data.distance_meters || 0),
      );
    }
    // 'date' — default order from API (most recent first)
    return list;
  }, [activeFilter, safeSavedPlaces, sortMode]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshSavedPlaces();
    setRefreshing(false);
  }, [refreshSavedPlaces]);

  const handleRemove = useCallback(
    (placeId: string, placeName: string) => {
      Alert.alert(
        'Remove saved place',
        `Remove "${placeName}" from your saved places?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setRemovingId(placeId);
              await toggleSavePlace(placeId);
              setRemovingId(null);
            },
          },
        ],
      );
    },
    [toggleSavePlace],
  );

  const handleCardPress = useCallback(
    (saved: SavedPlace) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: buildSiteDetailData(saved.place_data),
      });
    },
    [navigation],
  );

  const cycleSort = useCallback(() => {
    setSortMode(prev => {
      const idx = SORT_CYCLE.indexOf(prev);
      return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    });
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: SavedPlace; index: number }) => (
      <PlaceCard
        saved={item}
        index={index}
        onPress={handleCardPress}
        onRemove={handleRemove}
        isRemoving={removingId === item.place_id}
      />
    ),
    [handleCardPress, handleRemove, removingId],
  );

  const keyExtractor = useCallback((item: SavedPlace) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-[#000000]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#000000', '#0C0A07', '#000000']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-5 pt-5 pb-3 flex-row items-end justify-between">
          <View>
            <Text className="font-['MontserratAlternates-SemiBold'] text-xs uppercase tracking-[1px] text-[#C9A84C]">
              COLLECTION
            </Text>
            <Text className="mt-1 font-['MontserratAlternates-Bold'] text-[26px] leading-9 text-[#F5F0E8]">
              Saved Places
            </Text>
            <Text className="mt-0.5 text-[#6B6357] text-xs font-['MontserratAlternates-Regular']">
              {safeSavedPlaces.length}{' '}
              {safeSavedPlaces.length === 1 ? 'place' : 'places'} saved
            </Text>
          </View>

          {/* Sort toggle */}
          <TouchableOpacity
            onPress={cycleSort}
            className="flex-row items-center gap-1.5 bg-[#141414] border border-white/10 rounded-full px-3 py-2"
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${SORT_LABELS[sortMode]}`}
          >
            <ArrowUpDown
              color={sortMode !== 'date' ? '#C9A84C' : '#6B6357'}
              size={13}
            />
            <Text className="text-[#B8AF9E] text-[11px] font-['MontserratAlternates-Medium']">
              {SORT_LABELS[sortMode]}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error banner */}
        {savedError && (
          <View className="mx-5 mb-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
            <Text className="text-red-400 text-xs font-['MontserratAlternates-Medium']">
              {savedError}
            </Text>
          </View>
        )}

        {/* Category filter chips */}
        {categories.length > 0 && (
          <View className="mb-3">
            <FlatList
              horizontal
              data={['All', ...categories]}
              keyExtractor={item => `filter-${item}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 4 }}
              renderItem={({ item }) => (
                <FilterChip
                  label={item}
                  active={activeFilter === item}
                  onPress={() => setActiveFilter(item)}
                />
              )}
            />
          </View>
        )}

        {/* Content */}
        {isLoadingSaved ? (
          <View className="flex-row flex-wrap px-5 gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : filteredPlaces.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8 pb-16">
            <View className="w-20 h-20 rounded-full bg-[#141414] border border-[rgba(201,168,76,0.2)] items-center justify-center mb-5">
              <Bookmark color="#D4860A" size={32} />
            </View>
            <Text className="text-[#F5F0E8] text-lg text-center font-['MontserratAlternates-SemiBold']">
              {activeFilter !== 'All'
                ? 'No places in this category'
                : 'No saved places yet'}
            </Text>
            <Text className="mt-2 text-[#B8AF9E] text-sm text-center font-['MontserratAlternates-Regular'] leading-5">
              {activeFilter !== 'All'
                ? 'Try a different filter or save more places.'
                : 'Discover monuments and tap the bookmark icon to build your personal heritage collection.'}
            </Text>
            {activeFilter === 'All' && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                className="mt-6 bg-[#C9A84C] rounded-xl px-6 py-3 flex-row items-center gap-2"
                accessibilityRole="button"
              >
                <Compass color="#0A0A0A" size={16} />
                <Text className="text-[#0A0A0A] text-sm font-['MontserratAlternates-Bold']">
                  Start Exploring
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredPlaces}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={2}
            columnWrapperStyle={{ paddingHorizontal: 20, gap: 12 }}
            contentContainerStyle={{ paddingBottom: 32, gap: 12 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#D4860A"
                colors={['#D4860A']}
              />
            }
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

export default Saved;
