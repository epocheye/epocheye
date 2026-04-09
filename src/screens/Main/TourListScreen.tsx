import React, { useCallback, useEffect, useState } from 'react';
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
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, BookOpen, Clock, Headphones, AlignLeft, Music2 } from 'lucide-react-native';
import { getTours } from '../../utils/api/tours';
import type { Tour } from '../../utils/api/tours';
import { useTourPurchase } from '../../shared/hooks';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';

type Props = MainScreenProps<'TourList'>;

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatPrice(paisе: number): string {
  return `₹${(paisе / 100).toFixed(0)}`;
}

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function ContentTypeIcon({ type }: { type: string }) {
  const color = '#6B6357';
  const size = 14;
  if (type === 'audio') return <Headphones color={color} size={size} />;
  if (type === 'mixed') return <Music2 color={color} size={size} />;
  return <AlignLeft color={color} size={size} />;
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

const SkeletonTourCard: React.FC = () => {
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
      style={[{ backgroundColor: '#141414', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }, style]}
    >
      <View style={{ width: '50%', height: 14, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 8 }} />
      <View style={{ width: '75%', height: 20, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.14)', marginBottom: 12 }} />
      <View style={{ width: '60%', height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16 }} />
      <View style={{ width: 120, height: 36, borderRadius: 12, backgroundColor: 'rgba(201,168,76,0.2)' }} />
    </Animated.View>
  );
};

// ─── TourCard ─────────────────────────────────────────────────────────────────

interface TourCardProps {
  tour: Tour;
  onPressCTA: (tour: Tour) => void;
}

const TourCard: React.FC<TourCardProps> = React.memo(({ tour, onPressCTA }) => {
  const hasAccess = tour.user_access.has_access;
  const isFree = tour.price_paise === 0;

  return (
    <View className="bg-[#141414] rounded-[20px] p-4 mb-3 border border-[rgba(255,255,255,0.08)]">
      {/* Monument name */}
      <Text className="text-[#D4860A] text-xs uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold'] mb-1">
        {tour.monument_name}
      </Text>

      {/* Tour title */}
      <Text className="text-[#F5F0E8] text-lg font-['MontserratAlternates-Bold'] leading-6 mb-1">
        {tour.title}
      </Text>

      {/* Meta row */}
      <View className="flex-row items-center gap-3 mb-3">
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
        {isFree && (
          <View className="bg-[#10B981]/15 border border-[#10B981]/30 rounded-full px-2 py-0.5">
            <Text className="text-[#10B981] text-[10px] font-['MontserratAlternates-SemiBold']">
              Free
            </Text>
          </View>
        )}
      </View>

      {/* Active badge */}
      {hasAccess && tour.user_access.expires_at && (
        <View className="flex-row items-center gap-1.5 mb-3">
          <View className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <Text className="text-[#10B981] text-xs font-['MontserratAlternates-Medium']">
            Active · expires in {formatExpiry(tour.user_access.expires_at)}
          </Text>
        </View>
      )}

      {/* CTA button */}
      <TouchableOpacity
        onPress={() => onPressCTA(tour)}
        className={`self-start px-4 py-2.5 rounded-xl flex-row items-center gap-1.5 ${
          hasAccess ? 'bg-[#10B981]' : isFree ? 'bg-[#D4860A]' : 'bg-[#C9A84C]'
        }`}
        accessibilityRole="button"
      >
        <BookOpen color="#0A0A0A" size={15} />
        <Text className="text-[#0A0A0A] text-sm font-['MontserratAlternates-SemiBold']">
          {hasAccess
            ? 'Start Tour'
            : isFree
            ? 'Free Tour'
            : `Buy Tour ${formatPrice(tour.price_paise)}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
TourCard.displayName = 'TourCard';

// ─── Screen ───────────────────────────────────────────────────────────────────

const TourListScreen: React.FC<Props> = ({ navigation, route }) => {
  const monumentName = route.params?.monumentName;
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const { purchasing, handleBuyTour } = useTourPurchase();

  const loadTours = useCallback(async () => {
    setLoading(true);
    const result = await getTours();
    if (result.success) {
      setTours(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  const handleCTA = useCallback(
    async (tour: Tour) => {
      if (tour.user_access.has_access) {
        navigation.navigate(ROUTES.MAIN.TOUR_DETAIL, {
          tourId: tour.id,
          tourTitle: tour.title,
        });
        return;
      }

      const result = await handleBuyTour(tour.id, tour.price_paise, tour.title);
      if (result?.accessGranted) {
        await loadTours(); // refresh access state
        navigation.navigate(ROUTES.MAIN.TOUR_DETAIL, {
          tourId: tour.id,
          tourTitle: tour.title,
        });
      }
    },
    [handleBuyTour, loadTours, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Tour }) => (
      <TourCard tour={item} onPressCTA={handleCTA} />
    ),
    [handleCTA],
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
            className="w-10 h-10 rounded-full bg-[#141414] border border-[rgba(255,255,255,0.1)] items-center justify-center"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-[#F5F0E8] text-xl font-['MontserratAlternates-Bold']">
              Tours
            </Text>
            {monumentName && (
              <Text className="text-[#6B6357] text-xs font-['MontserratAlternates-Regular'] mt-0.5">
                {monumentName}
              </Text>
            )}
          </View>
        </View>

        {/* List */}
        {loading || purchasing ? (
          <View className="px-5">
            <SkeletonTourCard />
            <SkeletonTourCard />
            <SkeletonTourCard />
          </View>
        ) : tours.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8 pb-16">
            <BookOpen color="#D4860A" size={40} />
            <Text className="mt-4 text-[#F5F0E8] text-lg text-center font-['MontserratAlternates-SemiBold']">
              No tours available
            </Text>
            <Text className="mt-2 text-[#B8AF9E] text-sm text-center font-['MontserratAlternates-Regular']">
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
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

export default TourListScreen;
