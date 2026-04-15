import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
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
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Headphones,
  AlignLeft,
  Music2,
  Sparkles,
} from 'lucide-react-native';
import { getTours, getMyTours } from '../../utils/api/tours';
import type { Tour, MyTour } from '../../utils/api/tours';
import { useTourPurchase } from '../../shared/hooks';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';

type Props = MainScreenProps<'TourList'>;

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatPrice(paise: number): string {
  return `\u20B9${(paise / 100).toFixed(0)}`;
}

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) {
    return 'Expired';
  }
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function ContentTypeIcon({ type }: { type: string }) {
  const color = '#6B6357';
  const size = 14;
  if (type === 'audio') {
    return <Headphones color={color} size={size} />;
  }
  if (type === 'mixed') {
    return <Music2 color={color} size={size} />;
  }
  return <AlignLeft color={color} size={size} />;
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

const SkeletonTourCard: React.FC = () => {
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.55, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={style}
      className="bg-surface-1 rounded-[20px] p-4 mb-3 border border-white/[0.08]"
    >
      <View className="w-1/2 h-3.5 rounded-md bg-white/10 mb-2" />
      <View className="w-3/4 h-5 rounded-md bg-white/[0.14] mb-3" />
      <View className="w-3/5 h-3 rounded-md bg-white/10 mb-4" />
      <View className="w-[120px] h-9 rounded-xl bg-[rgba(201,168,76,0.2)]" />
    </Animated.View>
  );
};

// ─── TourCard ─────────────────────────────────────────────────────────────────

interface TourCardProps {
  tour: Tour;
  index: number;
  onPressCTA: (tour: Tour) => void;
}

const TourCard: React.FC<TourCardProps> = React.memo(
  ({ tour, index, onPressCTA }) => {
    const hasAccess = tour.user_access.has_access;
    const isFree = tour.price_paise === 0;

    return (
      <Animated.View entering={FadeInDown.delay(index * 80).duration(350)}>
        <View className="bg-surface-1 rounded-[20px] p-4 mb-3 border border-white/[0.08]">
          {/* Monument name */}
          <Text className="text-brand-amber text-xs uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold'] mb-1">
            {tour.monument_name}
          </Text>

          {/* Tour title */}
          <Text className="text-parchment text-lg font-['MontserratAlternates-Bold'] leading-6 mb-1">
            {tour.title}
          </Text>

          {/* Meta row */}
          <View className="flex-row items-center gap-3 mb-3">
            <View className="flex-row items-center gap-1">
              <Clock color="#6B6357" size={13} />
              <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular']">
                {tour.duration_minutes} min
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <ContentTypeIcon type={tour.content_type} />
              <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular'] capitalize">
                {tour.content_type}
              </Text>
            </View>
            {isFree && (
              <View className="bg-status-success/15 border border-status-success/30 rounded-full px-2 py-0.5">
                <Text className="text-status-success text-[10px] font-['MontserratAlternates-SemiBold']">
                  Free
                </Text>
              </View>
            )}
          </View>

          {/* Active badge */}
          {hasAccess && tour.user_access.expires_at && (
            <View className="flex-row items-center gap-1.5 mb-3">
              <View className="w-1.5 h-1.5 rounded-full bg-status-success" />
              <Text className="text-status-success text-xs font-['MontserratAlternates-Medium']">
                Active · expires in {formatExpiry(tour.user_access.expires_at)}
              </Text>
            </View>
          )}

          {/* CTA button */}
          <TouchableOpacity
            onPress={() => onPressCTA(tour)}
            className={`self-start px-4 py-2.5 rounded-xl flex-row items-center gap-1.5 ${
              hasAccess
                ? 'bg-status-success'
                : isFree
                ? 'bg-brand-amber'
                : 'bg-brand-gold'
            }`}
            accessibilityRole="button"
          >
            <BookOpen color="#0A0A0A" size={15} />
            <Text className="text-ink text-sm font-['MontserratAlternates-SemiBold']">
              {hasAccess
                ? 'Start Tour'
                : isFree
                ? 'Free Tour'
                : `Buy Tour ${formatPrice(tour.price_paise)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  },
);
TourCard.displayName = 'TourCard';

// ─── Screen ───────────────────────────────────────────────────────────────────

const TourListScreen: React.FC<Props> = ({ navigation, route }) => {
  const monumentId = route.params?.monumentId;
  const monumentName = route.params?.monumentName;
  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [myTours, setMyTours] = useState<MyTour[]>([]);
  const [loading, setLoading] = useState(true);
  const { purchasing, handleBuyTour } = useTourPurchase();

  const loadTours = useCallback(async () => {
    setLoading(true);
    const [toursResult, myToursResult] = await Promise.all([
      getTours(),
      getMyTours(),
    ]);
    if (toursResult.success) {
      setAllTours(toursResult.data);
    }
    if (myToursResult.success) {
      setMyTours(myToursResult.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  // Filter tours by monument if param provided
  const tours = useMemo(() => {
    if (!monumentId) {
      return allTours;
    }
    return allTours.filter(t => t.monument_id === monumentId);
  }, [allTours, monumentId]);

  // Active purchased tours (not already in the filtered list)
  const activePurchased = useMemo(() => {
    if (!monumentId) {
      return [];
    }
    const tourIds = new Set(tours.map(t => t.id));
    return myTours.filter(
      mt =>
        mt.monument_id === monumentId &&
        mt.user_access.has_access &&
        !tourIds.has(mt.id),
    );
  }, [tours, myTours, monumentId]);

  const handleCTA = useCallback(
    async (tour: Tour) => {
      if (tour.user_access.has_access) {
        navigation.navigate(ROUTES.MAIN.TOUR_DETAIL, {
          tourId: tour.id,
          tourTitle: tour.title,
        });
        return;
      }

      const result = await handleBuyTour(
        tour.id,
        tour.price_paise,
        tour.title,
      );
      if (result?.accessGranted) {
        await loadTours();
        navigation.navigate(ROUTES.MAIN.TOUR_DETAIL, {
          tourId: tour.id,
          tourTitle: tour.title,
        });
      }
    },
    [handleBuyTour, loadTours, navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Tour; index: number }) => (
      <TourCard tour={item} index={index} onPressCTA={handleCTA} />
    ),
    [handleCTA],
  );

  return (
    <SafeAreaView className="flex-1 bg-ink-deep">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#000000', '#0C0A07', '#000000']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-surface-1 border border-white/10 items-center justify-center"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-parchment text-xl font-['MontserratAlternates-Bold']">
              {monumentName ? 'Tours' : 'All Tours'}
            </Text>
            {monumentName && (
              <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular'] mt-0.5">
                {monumentName}
              </Text>
            )}
          </View>
          {/* My Tours link */}
          <TouchableOpacity
            onPress={() => navigation.navigate(ROUTES.MAIN.MY_TOURS)}
            className="bg-surface-1 border border-white/10 rounded-full px-3 py-1.5"
          >
            <Text className="text-brand-amber text-xs font-['MontserratAlternates-SemiBold']">
              My Tours
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading || purchasing ? (
          <View className="px-5">
            <SkeletonTourCard />
            <SkeletonTourCard />
            <SkeletonTourCard />
          </View>
        ) : tours.length === 0 && activePurchased.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8 pb-16">
            <BookOpen color="#D4860A" size={40} />
            <Text className="mt-4 text-parchment text-lg text-center font-['MontserratAlternates-SemiBold']">
              {monumentName
                ? `No tours for ${monumentName} yet`
                : 'No tours available'}
            </Text>
            <Text className="mt-2 text-parchment-muted text-sm text-center font-['MontserratAlternates-Regular']">
              Check back soon — guided tours are coming to more monuments.
            </Text>
          </View>
        ) : (
          <FlatList
            data={tours}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              activePurchased.length > 0 ? (
                <View className="mb-4">
                  <View className="flex-row items-center gap-1.5 mb-3">
                    <Sparkles color="#10B981" size={14} />
                    <Text className="text-status-success text-sm font-['MontserratAlternates-SemiBold']">
                      Your Active Tours
                    </Text>
                  </View>
                  {activePurchased.map(mt => (
                    <TouchableOpacity
                      key={mt.id}
                      onPress={() =>
                        navigation.navigate(ROUTES.MAIN.TOUR_DETAIL, {
                          tourId: mt.id,
                          tourTitle: mt.title,
                        })
                      }
                      className="bg-status-success/10 border border-status-success/20 rounded-2xl p-3 mb-2 flex-row items-center gap-3"
                    >
                      <BookOpen color="#10B981" size={18} />
                      <View className="flex-1">
                        <Text className="text-parchment text-sm font-['MontserratAlternates-SemiBold']">
                          {mt.title}
                        </Text>
                        {mt.user_access.expires_at && (
                          <Text className="text-status-success text-xs font-['MontserratAlternates-Regular'] mt-0.5">
                            Expires in{' '}
                            {formatExpiry(mt.user_access.expires_at)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null
            }
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

export default TourListScreen;
