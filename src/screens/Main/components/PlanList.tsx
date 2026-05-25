/**
 * PlanList — embeddable list of curated heritage sites from our DB.
 * Rendered inside the Passport tab's "Plan" mode (see Passport.tsx).
 *
 * Sourced from GET /api/v1/sites (status active|published) so this is the
 * catalogue of monuments we have AR/curated content for — not the user's
 * Geoapify "saved places" (those still live in the Zustand savedPlaces slice
 * and are surfaced elsewhere).
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, RefreshControl, Text, TouchableOpacity, View} from 'react-native';
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
import {ArrowUpDown, Bookmark, MapPin} from 'lucide-react-native';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import {getSites} from '../../../utils/api/places/Places';
import type {SiteDetail} from '../../../utils/api/places/types';
import {usePlacesStore} from '../../../stores/placesStore';

type SortMode = 'name' | 'distance';

const SORT_LABELS: Record<SortMode, string> = {
  name: 'A–Z',
  distance: 'Nearest',
};

const SORT_CYCLE: SortMode[] = ['name', 'distance'];

const FALLBACK_SITE_IMAGE =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80';

function haversineKm(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

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

interface SiteCardProps {
  site: SiteDetail;
  index: number;
  onPress: (site: SiteDetail) => void;
  distanceKmFromUser: number | null;
}

const SiteCard: React.FC<SiteCardProps> = React.memo(
  ({site, index, onPress, distanceKmFromUser}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{scale: scale.value}],
    }));

    const tag = site.era || site.dynasty || site.architectural_style || 'Heritage';
    const subtitleParts = [site.city, site.state].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
    const subtitle = subtitleParts.join(' · ');
    const distanceLabel =
      distanceKmFromUser !== null
        ? `${distanceKmFromUser.toFixed(1)} km`
        : null;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(350)}
        style={[{flex: 1}, animatedStyle]}>
        <TouchableOpacity
          onPress={() => onPress(site)}
          onPressIn={() => {
            scale.value = withSpring(0.97, {damping: 15, stiffness: 300});
          }}
          onPressOut={() => {
            scale.value = withSpring(1, {damping: 15, stiffness: 300});
          }}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Plan ${site.name}`}
          accessibilityHint="Tap to view site details">
          <ResolvedSubjectImage
            subject={site.name}
            context={`${site.city ?? ''} ${site.country ?? ''} ${tag}`.trim()}
            fallbackUri={site.hero_image_url || FALLBACK_SITE_IMAGE}
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
                    {tag}
                  </Text>
                </View>
              </View>

              <View>
                <Text
                  className="text-parchment text-[18px] font-['InstrumentSerif-Regular'] leading-6"
                  numberOfLines={2}>
                  {site.name}
                </Text>
                {(subtitle.length > 0 || distanceLabel) && (
                  <View className="flex-row items-center gap-1 mt-1">
                    <MapPin color="#B8AF9E" size={11} />
                    <Text
                      className="text-parchment-muted text-[11px] font-['InstrumentSans-Medium'] flex-shrink"
                      numberOfLines={1}>
                      {subtitle}
                      {subtitle.length > 0 && distanceLabel ? ' · ' : ''}
                      {distanceLabel ?? ''}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </ResolvedSubjectImage>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);
SiteCard.displayName = 'PlanListSiteCard';

export interface PlanListProps {
  onPlacePress: (site: SiteDetail) => void;
}

const PlanList: React.FC<PlanListProps> = ({onPlacePress}) => {
  const userLocation = usePlacesStore(state => state.currentLocation);

  const [sites, setSites] = useState<SiteDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [refreshing, setRefreshing] = useState(false);

  const loadSites = useCallback(async () => {
    const result = await getSites();
    if (result.success) {
      setSites(result.data);
      setError(null);
    } else {
      setError(result.error.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      await loadSites();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSites]);

  const sortedSites = useMemo(() => {
    const userCoord =
      userLocation &&
      typeof userLocation.latitude === 'number' &&
      typeof userLocation.longitude === 'number'
        ? {lat: userLocation.latitude, lng: userLocation.longitude}
        : null;

    const withDistance = sites.map(site => {
      const lat = site.latitude;
      const lng = site.longitude;
      const distanceKm =
        userCoord && typeof lat === 'number' && typeof lng === 'number'
          ? haversineKm(userCoord, {lat, lng})
          : null;
      return {site, distanceKm};
    });

    if (sortMode === 'distance') {
      return [...withDistance].sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return [...withDistance].sort((a, b) =>
      a.site.name.localeCompare(b.site.name),
    );
  }, [sites, sortMode, userLocation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSites();
    setRefreshing(false);
  }, [loadSites]);

  const cycleSort = useCallback(() => {
    setSortMode(prev => {
      const idx = SORT_CYCLE.indexOf(prev);
      return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    });
  }, []);

  const renderItem = useCallback(
    ({
      item,
      index,
    }: {
      item: {site: SiteDetail; distanceKm: number | null};
      index: number;
    }) => (
      <SiteCard
        site={item.site}
        index={index}
        onPress={onPlacePress}
        distanceKmFromUser={item.distanceKm}
      />
    ),
    [onPlacePress],
  );

  const keyExtractor = useCallback(
    (item: {site: SiteDetail}) => item.site.slug ?? item.site.id,
    [],
  );

  return (
    <View className="flex-1">
      <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
        <Text className="text-parchment-dim text-xs font-['InstrumentSans-Regular']">
          {sortedSites.length}{' '}
          {sortedSites.length === 1 ? 'site' : 'sites'} available
        </Text>
        <TouchableOpacity
          onPress={cycleSort}
          className="flex-row items-center gap-1.5 bg-surface-1 border border-white/10 rounded-full px-3 py-2"
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${SORT_LABELS[sortMode]}`}>
          <ArrowUpDown
            color={sortMode === 'distance' ? '#C9A84C' : '#6B6357'}
            size={13}
          />
          <Text className="text-parchment-muted text-[11px] font-['InstrumentSans-Medium']">
            {SORT_LABELS[sortMode]}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View className="mx-5 mb-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
          <Text className="text-red-400 text-xs font-['InstrumentSans-Medium']">
            {error}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="flex-row flex-wrap px-5 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : sortedSites.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 pb-12">
          <View className="w-20 h-20 rounded-full bg-surface-1 border border-[rgba(201,168,76,0.2)] items-center justify-center mb-5">
            <Bookmark color="#D4860A" size={32} />
          </View>
          <Text className="text-parchment text-lg text-center font-['InstrumentSerif-Regular']">
            No sites available yet
          </Text>
          <Text className="mt-2 text-parchment-muted text-sm text-center font-['InstrumentSans-Regular'] leading-5">
            New heritage sites are being added. Pull down to refresh.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedSites}
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
