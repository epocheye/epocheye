/**
 * PlanList — embeddable list of the user's saved/planned places.
 * Rendered inside the Passport tab's "Plan" mode (see Passport.tsx).
 *
 * Extracted from the original Saved.tsx screen but stripped of screen-level
 * chrome (SafeAreaView, header) so it can live inside a host screen.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  MapPin,
  Trash2,
} from 'lucide-react-native';
import AnimatedLogo from '../../../components/ui/AnimatedLogo';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import {usePlaces} from '../../../context';
import type {SavedPlace} from '../../../utils/api/places/types';
import {getPlaceImage} from '../../../shared/utils';

type SortMode = 'date' | 'name' | 'distance';

const SORT_LABELS: Record<SortMode, string> = {
  date: 'Recent',
  name: 'A–Z',
  distance: 'Nearest',
};

const SORT_CYCLE: SortMode[] = ['date', 'name', 'distance'];

const SkeletonCard: React.FC = () => {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 900, easing: Easing.inOut(Easing.quad)}),
        withTiming(0.55, {duration: 900, easing: Easing.inOut(Easing.quad)}),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({opacity: pulse.value}));

  return (
    <Animated.View
      style={style}
      className="flex-1 h-[200px] rounded-2xl bg-surface-1 border border-white/[0.08] p-3 justify-end">
      <View className="w-16 h-5 rounded-full bg-white/10 mb-2" />
      <View className="w-3/4 h-5 rounded-md bg-white/[0.14] mb-2" />
      <View className="w-1/2 h-3 rounded-md bg-white/10" />
    </Animated.View>
  );
};

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({label, active, onPress}) => (
  <TouchableOpacity
    onPress={onPress}
    className={`mr-2 px-3 py-1.5 rounded-full border ${
      active
        ? 'bg-brand-gold border-brand-gold'
        : 'bg-transparent border-[rgba(201,168,76,0.3)]'
    }`}
    accessibilityRole="button"
    accessibilityState={{selected: active}}>
    <Text
      className={`text-xs font-['InstrumentSans-SemiBold'] ${
        active ? 'text-ink' : 'text-parchment-muted'
      }`}>
      {label}
    </Text>
  </TouchableOpacity>
);

interface PlaceCardProps {
  saved: SavedPlace;
  index: number;
  onPress: (saved: SavedPlace) => void;
  onRemove: (placeId: string, name: string) => void;
  isRemoving: boolean;
}

const PlaceCard: React.FC<PlaceCardProps> = React.memo(
  ({saved, index, onPress, onRemove, isRemoving}) => {
    const place = saved.place_data;
    const imageUri = getPlaceImage(place.categories);
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{scale: scale.value}],
    }));

    const distanceKm =
      place.distance_meters > 0
        ? `${(place.distance_meters / 1000).toFixed(1)} km`
        : null;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(350)}
        exiting={FadeOut.duration(250)}
        style={[{flex: 1}, animatedStyle]}>
        <TouchableOpacity
          onPress={() => onPress(saved)}
          onLongPress={() => onRemove(place.id, place.name)}
          onPressIn={() => {
            scale.value = withSpring(0.97, {damping: 15, stiffness: 300});
          }}
          onPressOut={() => {
            scale.value = withSpring(1, {damping: 15, stiffness: 300});
          }}
          activeOpacity={0.9}
          disabled={isRemoving}
          accessibilityRole="button"
          accessibilityLabel={`Planned place: ${place.name}`}
          accessibilityHint="Tap to view details, long press to remove">
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country} ${place.categories.join(', ')}`}
            fallbackUri={imageUri}
            style={{height: 200, borderRadius: 16}}
            imageStyle={{borderRadius: 16}}
            loadingLabel="Loading...">
            <LinearGradient
              colors={['rgba(8,8,8,0.05)', 'rgba(8,8,8,0.9)']}
              className="flex-1 rounded-2xl p-3 justify-between"
              style={{borderRadius: 16}}>
              <View className="flex-row items-start justify-between">
                <View className="rounded-full bg-[rgba(10,10,10,0.8)] border border-[rgba(201,168,76,0.35)] px-2 py-1">
                  <Text
                    className="text-parchment text-[10px] font-['InstrumentSans-SemiBold']"
                    numberOfLines={1}>
                    {place.categories[0] || 'Historic'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onRemove(place.id, place.name)}
                  disabled={isRemoving}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  className="w-7 h-7 rounded-full bg-[rgba(10,10,10,0.7)] border border-red-500/30 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${place.name}`}>
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

              <View>
                <Text
                  className="text-parchment text-[18px] font-['InstrumentSerif-Regular'] leading-6"
                  numberOfLines={2}>
                  {place.name}
                </Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <MapPin color="#B8AF9E" size={11} />
                  <Text
                    className="text-parchment-muted text-[11px] font-['InstrumentSans-Medium'] flex-shrink"
                    numberOfLines={1}>
                    {place.city}
                    {distanceKm ? ` · ${distanceKm}` : ''}
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
PlaceCard.displayName = 'PlanListPlaceCard';

export interface PlanListProps {
  onPlacePress: (saved: SavedPlace) => void;
}

const PlanList: React.FC<PlanListProps> = ({onPlacePress}) => {
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

  const safeSavedPlaces = useMemo(
    () =>
      (savedPlaces || []).filter(
        saved =>
          !!saved?.place_data && Array.isArray(saved.place_data.categories),
      ),
    [savedPlaces],
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    safeSavedPlaces.forEach(saved => {
      saved.place_data.categories.forEach(cat => cats.add(cat));
    });
    return Array.from(cats).slice(0, 8);
  }, [safeSavedPlaces]);

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
        'Remove from plan',
        `Remove "${placeName}" from your plan?`,
        [
          {text: 'Cancel', style: 'cancel'},
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

  const cycleSort = useCallback(() => {
    setSortMode(prev => {
      const idx = SORT_CYCLE.indexOf(prev);
      return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    });
  }, []);

  const renderItem = useCallback(
    ({item, index}: {item: SavedPlace; index: number}) => (
      <PlaceCard
        saved={item}
        index={index}
        onPress={onPlacePress}
        onRemove={handleRemove}
        isRemoving={removingId === item.place_id}
      />
    ),
    [onPlacePress, handleRemove, removingId],
  );

  const keyExtractor = useCallback((item: SavedPlace) => item.id, []);

  return (
    <View className="flex-1">
      <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
        <Text className="text-parchment-dim text-xs font-['InstrumentSans-Regular']">
          {safeSavedPlaces.length}{' '}
          {safeSavedPlaces.length === 1 ? 'place planned' : 'places planned'}
        </Text>
        <TouchableOpacity
          onPress={cycleSort}
          className="flex-row items-center gap-1.5 bg-surface-1 border border-white/10 rounded-full px-3 py-2"
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${SORT_LABELS[sortMode]}`}>
          <ArrowUpDown
            color={sortMode !== 'date' ? '#C9A84C' : '#6B6357'}
            size={13}
          />
          <Text className="text-parchment-muted text-[11px] font-['InstrumentSans-Medium']">
            {SORT_LABELS[sortMode]}
          </Text>
        </TouchableOpacity>
      </View>

      {savedError && (
        <View className="mx-5 mb-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
          <Text className="text-red-400 text-xs font-['InstrumentSans-Medium']">
            {savedError}
          </Text>
        </View>
      )}

      {categories.length > 0 && (
        <View className="mb-3">
          <FlatList
            horizontal
            data={['All', ...categories]}
            keyExtractor={item => `filter-${item}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal: 20, paddingVertical: 4}}
            renderItem={({item}) => (
              <FilterChip
                label={item}
                active={activeFilter === item}
                onPress={() => setActiveFilter(item)}
              />
            )}
          />
        </View>
      )}

      {isLoadingSaved ? (
        <View className="flex-row flex-wrap px-5 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : filteredPlaces.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 pb-12">
          <View className="w-20 h-20 rounded-full bg-surface-1 border border-[rgba(201,168,76,0.2)] items-center justify-center mb-5">
            <Bookmark color="#D4860A" size={32} />
          </View>
          <Text className="text-parchment text-lg text-center font-['InstrumentSerif-Regular']">
            {activeFilter !== 'All'
              ? 'No places in this category'
              : 'No planned places yet'}
          </Text>
          <Text className="mt-2 text-parchment-muted text-sm text-center font-['InstrumentSans-Regular'] leading-5">
            {activeFilter !== 'All'
              ? 'Try a different filter or add more places to your plan.'
              : 'Open a site detail and tap the bookmark icon to add it to your plan.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPlaces}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={{paddingHorizontal: 20, gap: 12}}
          contentContainerStyle={{paddingBottom: 32, gap: 12}}
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
    </View>
  );
};

export default PlanList;
