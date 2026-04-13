import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
} from 'lucide-react-native';
import { getMyTours } from '../../utils/api/tours';
import type { MyTour } from '../../utils/api/tours';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';

type Props = MainScreenProps<'MyTours'>;

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => {
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
      className="bg-[#141414] rounded-[20px] p-4 mb-3 border border-white/[0.08]"
    >
      <View className="w-1/3 h-3 rounded-md bg-white/10 mb-2" />
      <View className="w-3/4 h-5 rounded-md bg-white/[0.14] mb-3" />
      <View className="w-1/2 h-3 rounded-md bg-white/10" />
    </Animated.View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const MyToursScreen: React.FC<Props> = ({ navigation }) => {
  const [tours, setTours] = useState<MyTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTours = useCallback(async () => {
    const result = await getMyTours();
    if (result.success) {
      setTours(result.data);
    }
  }, []);

  useEffect(() => {
    loadTours().finally(() => setLoading(false));
  }, [loadTours]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTours();
    setRefreshing(false);
  }, [loadTours]);

  const activeTours = useMemo(
    () => tours.filter(t => t.user_access.has_access),
    [tours],
  );

  const expiredTours = useMemo(
    () => tours.filter(t => !t.user_access.has_access),
    [tours],
  );

  const handleTourPress = useCallback(
    (tour: MyTour) => {
      if (tour.user_access.has_access) {
        navigation.navigate(ROUTES.MAIN.TOUR_DETAIL, {
          tourId: tour.id,
          tourTitle: tour.title,
        });
      } else {
        // Navigate to tour list to re-purchase
        navigation.navigate(ROUTES.MAIN.TOUR_LIST, {
          monumentId: tour.monument_id,
          monumentName: tour.monument_name,
        });
      }
    },
    [navigation],
  );

  const renderTour = useCallback(
    (tour: MyTour, index: number, isExpired: boolean) => (
      <Animated.View
        key={tour.id}
        entering={FadeInDown.delay(index * 80).duration(350)}
      >
        <TouchableOpacity
          onPress={() => handleTourPress(tour)}
          activeOpacity={0.86}
          className={`bg-[#141414] rounded-[20px] p-4 mb-3 border ${
            isExpired
              ? 'border-white/[0.05] opacity-60'
              : 'border-white/[0.08]'
          }`}
        >
          {/* Monument name */}
          <Text className="text-[#D4860A] text-xs uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold'] mb-1">
            {tour.monument_name}
          </Text>

          {/* Title */}
          <Text className="text-[#F5F0E8] text-lg font-['MontserratAlternates-Bold'] leading-6 mb-1">
            {tour.title}
          </Text>

          {/* Meta */}
          <View className="flex-row items-center gap-3 mb-2">
            <View className="flex-row items-center gap-1">
              <Clock color="#6B6357" size={13} />
              <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular']">
                {tour.duration_minutes} min
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <ContentTypeIcon type={tour.content_type} />
              <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular'] capitalize">
                {tour.content_type}
              </Text>
            </View>
            {tour.source === 'free_grant' && (
              <View className="bg-[#10B981]/15 border border-[#10B981]/30 rounded-full px-2 py-0.5">
                <Text className="text-[#10B981] text-[10px] font-['MontserratAlternates-SemiBold']">
                  Free
                </Text>
              </View>
            )}
          </View>

          {/* Status */}
          {isExpired ? (
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-[#6B6357]" />
              <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Medium']">
                Expired
              </Text>
            </View>
          ) : tour.user_access.expires_at ? (
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              <Text className="text-[#10B981] text-xs font-['MontserratAlternates-Medium']">
                Active · expires in{' '}
                {formatExpiry(tour.user_access.expires_at)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    ),
    [handleTourPress],
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0A', '#14110B', '#0A0A0A']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-[#141414] border border-white/10 items-center justify-center"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>
          <Text className="text-[#F5F0E8] text-xl font-['MontserratAlternates-Bold']">
            My Tours
          </Text>
        </View>

        {loading ? (
          <View className="px-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : tours.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8 pb-16">
            <BookOpen color="#D4860A" size={40} />
            <Text className="mt-4 text-[#F5F0E8] text-lg text-center font-['MontserratAlternates-SemiBold']">
              No tours yet
            </Text>
            <Text className="mt-2 text-[#B8AF9E] text-sm text-center font-['MontserratAlternates-Regular'] leading-5">
              Discover guided heritage experiences — stories, voices, and
              histories brought to life.
            </Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(ROUTES.MAIN.TOUR_LIST, undefined)
              }
              className="mt-6 bg-[#C9A84C] rounded-xl px-6 py-3 flex-row items-center gap-2"
            >
              <BookOpen color="#0A0A0A" size={16} />
              <Text className="text-[#0A0A0A] text-sm font-['MontserratAlternates-Bold']">
                Browse Tours
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={[
              ...(activeTours.length > 0 ? [{ type: 'header' as const, title: 'Active' }] : []),
              ...activeTours.map(t => ({ type: 'tour' as const, tour: t, expired: false })),
              ...(expiredTours.length > 0 ? [{ type: 'header' as const, title: 'Expired' }] : []),
              ...expiredTours.map(t => ({ type: 'tour' as const, tour: t, expired: true })),
            ]}
            keyExtractor={(item, _i) =>
              item.type === 'header' ? `header-${item.title}` : item.tour.id
            }
            renderItem={({ item, index }) => {
              if (item.type === 'header') {
                return (
                  <Text className="text-[#6B6357] text-xs uppercase tracking-[1px] font-['MontserratAlternates-SemiBold'] mb-3 mt-4">
                    {item.title}
                  </Text>
                );
              }
              return renderTour(item.tour, index, item.expired);
            }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
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

export default MyToursScreen;
