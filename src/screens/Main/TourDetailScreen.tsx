import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  Tag,
  X,
} from 'lucide-react-native';
import { getTour, validateCoupon } from '../../utils/api/tours';
import type { CouponValidation, Tour } from '../../utils/api/tours';
import { useTourPurchase } from '../../shared/hooks';
import type { MainScreenProps } from '../../core/types/navigation.types';
import AudioPlayer from '../../components/AudioPlayer';
import ResolvedSubjectImage from '../../components/ui/ResolvedSubjectImage';

type Props = MainScreenProps<'TourDetail'>;

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

const TourDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { tourId, tourTitle } = route.params;
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const { purchasing, handleBuyTour } = useTourPurchase();

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(
    null,
  );

  const appliedCoupon = couponResult?.is_valid ? couponResult.code : undefined;

  const loadTour = useCallback(async () => {
    setLoading(true);
    const result = await getTour(tourId);
    if (result.success) {
      setTour(result.data);
    }
    setLoading(false);
  }, [tourId]);

  useEffect(() => {
    loadTour();
  }, [loadTour]);

  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      return;
    }
    setCouponValidating(true);
    setCouponResult(null);
    const result = await validateCoupon(code);
    if (result.success) {
      setCouponResult(result.data);
    } else {
      setCouponResult({ is_valid: false, reason: 'not_found' });
    }
    setCouponValidating(false);
  }, [couponInput]);

  const handleClearCoupon = useCallback(() => {
    setCouponInput('');
    setCouponResult(null);
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!tour) {
      return;
    }
    const result = await handleBuyTour(
      tour.id,
      tour.price_paise,
      tour.title,
      appliedCoupon,
    );
    if (result?.accessGranted) {
      await loadTour();
    }
  }, [handleBuyTour, loadTour, tour, appliedCoupon]);

  // Loading / purchasing state
  if (loading || purchasing) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0A0A] items-center justify-center">
        <StatusBar barStyle="light-content" />
        <Text className="text-[#B8AF9E] text-sm font-['MontserratAlternates-Regular']">
          {purchasing ? 'Processing payment...' : 'Loading tour...'}
        </Text>
      </SafeAreaView>
    );
  }

  // Not found
  if (!tour) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0A0A] items-center justify-center px-8">
        <StatusBar barStyle="light-content" />
        <Text className="text-[#F5F0E8] text-lg text-center font-['MontserratAlternates-SemiBold']">
          Tour not found
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-4 px-4 py-2.5 rounded-xl bg-[#141414] border border-white/10"
        >
          <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-Medium']">
            Go back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const hasAccess = tour.user_access.has_access;
  const isFree = tour.price_paise === 0;
  const isAudio =
    tour.content_type === 'audio' || tour.content_type === 'mixed';
  const isText =
    tour.content_type === 'text' || tour.content_type === 'mixed';

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
          <View className="flex-1">
            <Text
              className="text-[#F5F0E8] text-xl font-['MontserratAlternates-Bold']"
              numberOfLines={1}
            >
              {tourTitle}
            </Text>
            {hasAccess && tour.user_access.expires_at && (
              <View className="flex-row items-center gap-1 mt-0.5">
                <View className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <Text className="text-[#10B981] text-xs font-['MontserratAlternates-Medium']">
                  Active · expires in{' '}
                  {formatExpiry(tour.user_access.expires_at)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Monument name */}
          <Text className="text-[#D4860A] text-xs uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold'] mb-2">
            {tour.monument_name}
          </Text>

          {/* Monument hero image */}
          <Animated.View
            entering={FadeIn.duration(400)}
            className="rounded-2xl overflow-hidden mb-4"
            style={{ height: 160 }}
          >
            <ResolvedSubjectImage
              subject={tour.monument_name}
              context={`${tour.monument_name} heritage tour`}
              style={{ width: '100%', height: 160, borderRadius: 16 }}
              imageStyle={{ width: '100%', height: 160, borderRadius: 16 }}
              loadingLabel="Loading..."
            />
          </Animated.View>

          {/* Description card */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(350)}
            className="bg-[#141414] rounded-2xl p-4 mb-4 border border-white/[0.08]"
          >
            <Text className="text-[#B8AF9E] text-sm font-['MontserratAlternates-Regular'] leading-5">
              {tour.description}
            </Text>
          </Animated.View>

          {/* Meta info */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(350)}
            className="flex-row gap-3 mb-4"
          >
            <View className="flex-row items-center gap-1.5 bg-[#141414] rounded-xl px-3 py-2 border border-white/[0.08]">
              <Clock color="#6B6357" size={14} />
              <Text className="text-[#B8AF9E] text-xs font-['MontserratAlternates-Medium']">
                {tour.duration_minutes} min
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 bg-[#141414] rounded-xl px-3 py-2 border border-white/[0.08]">
              <BookOpen color="#6B6357" size={14} />
              <Text className="text-[#B8AF9E] text-xs font-['MontserratAlternates-Medium'] capitalize">
                {tour.content_type}
              </Text>
            </View>
            {!hasAccess && (
              <View className="flex-row items-center gap-1.5 bg-[#141414] rounded-xl px-3 py-2 border border-white/[0.08]">
                <Text className="text-[#C9A84C] text-xs font-['MontserratAlternates-SemiBold']">
                  {isFree ? 'Free' : formatPrice(tour.price_paise)}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Content or purchase prompt */}
          {hasAccess && tour.content_body ? (
            <Animated.View entering={FadeInDown.delay(200).duration(350)}>
              {/* Audio player */}
              {isAudio && (
                <View className="mb-4">
                  <AudioPlayer
                    uri={tour.content_body}
                    title={`${tour.monument_name} — ${tour.title}`}
                  />
                </View>
              )}

              {/* Text content */}
              {isText && (
                <View className="bg-[#141414] rounded-2xl p-5 border border-white/[0.08]">
                  <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-Regular'] leading-7">
                    {tour.content_body}
                  </Text>
                </View>
              )}
            </Animated.View>
          ) : !hasAccess ? (
            /* Purchase section */
            <Animated.View
              entering={FadeInDown.delay(200).duration(350)}
              className="gap-3"
            >
              {/* Coupon input — only for paid tours */}
              {!isFree && (
                <View className="bg-[#141414] border border-white/[0.08] rounded-2xl p-4">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Tag color="#C9A84C" size={13} />
                    <Text className="text-[#B8AF9E] text-xs font-['MontserratAlternates-Medium']">
                      Have a promo code?
                    </Text>
                  </View>

                  {couponResult?.is_valid ? (
                    <View className="flex-row items-center justify-between bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl px-3 py-2.5">
                      <View className="flex-row items-center gap-2">
                        <Check color="#10B981" size={14} />
                        <Text className="text-[#10B981] text-sm font-['MontserratAlternates-SemiBold']">
                          {couponResult.code} ·{' '}
                          {couponResult.discount_percent}% off
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleClearCoupon}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X color="#10B981" size={14} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="flex-row gap-2">
                      <TextInput
                        value={couponInput}
                        onChangeText={t => {
                          setCouponInput(t.toUpperCase());
                          if (couponResult) {
                            setCouponResult(null);
                          }
                        }}
                        placeholder="Enter code"
                        placeholderTextColor="rgba(245,240,232,0.25)"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={handleApplyCoupon}
                        className="flex-1 bg-[#1E1E1E] border border-white/10 rounded-xl px-3 py-2.5 text-[#F5F0E8] text-sm font-['MontserratAlternates-Regular']"
                      />
                      <TouchableOpacity
                        onPress={handleApplyCoupon}
                        disabled={couponValidating || !couponInput.trim()}
                        className="bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded-xl px-4 items-center justify-center"
                      >
                        {couponValidating ? (
                          <ActivityIndicator color="#C9A84C" size="small" />
                        ) : (
                          <Text className="text-[#C9A84C] text-sm font-['MontserratAlternates-SemiBold']">
                            Apply
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {couponResult && !couponResult.is_valid && (
                    <Text className="text-red-400 text-xs mt-2 font-['MontserratAlternates-Regular']">
                      {couponResult.reason === 'expired'
                        ? 'This code has expired.'
                        : couponResult.reason === 'exhausted'
                        ? 'This code has reached its usage limit.'
                        : 'Invalid promo code. Please check and try again.'}
                    </Text>
                  )}
                </View>
              )}

              {/* Buy button */}
              <TouchableOpacity
                onPress={handlePurchase}
                className="py-4 rounded-2xl items-center justify-center flex-row gap-2"
                style={{
                  backgroundColor: isFree ? '#D4860A' : '#C9A84C',
                }}
                accessibilityRole="button"
              >
                <BookOpen color="#0A0A0A" size={18} />
                <Text className="text-[#0A0A0A] text-base font-['MontserratAlternates-Bold']">
                  {isFree
                    ? 'Start Free Tour'
                    : appliedCoupon && couponResult?.discount_percent
                    ? `Buy Tour ${formatPrice(
                        Math.round(
                          tour.price_paise *
                            (1 - couponResult.discount_percent / 100),
                        ),
                      )}`
                    : `Buy Tour ${formatPrice(tour.price_paise)}`}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View className="items-center py-6">
              <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Regular']">
                Tour content is not available yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default TourDetailScreen;
