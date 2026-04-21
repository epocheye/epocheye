import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Check,
  Compass,
  MapPin,
  RefreshCw,
  Shield,
  Sparkles,
  Tag,
  X,
} from 'lucide-react-native';
import { Linking } from 'react-native';
import { validateCoupon } from '../../utils/api/coupons';
import type { CouponValidation } from '../../utils/api/coupons';
import {
  getExplorerPassConfig,
  getExplorerPassQuote,
  type ExplorerPassConfig,
  type ExplorerPassQuote,
  type PricingTier,
} from '../../utils/api/explorer-pass';
import {
  useExplorerPass,
  useExplorerPassPurchase,
} from '../../shared/hooks';
import { usePlacesStore } from '../../stores/placesStore';
import { formatPlaceType } from '../../shared/utils/formatters';
import { getPlaceImage } from '../../shared/utils';
import ResolvedSubjectImage from '../../components/ui/ResolvedSubjectImage';
import type { MainScreenProps } from '../../core/types/navigation.types';

type Props = MainScreenProps<'Purchase'>;

function formatInr(paise: number): string {
  return `\u20B9${Math.round(paise / 100)}`;
}

function formatAccessDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? 's' : ''}`;
}

function findTierForCount(tiers: PricingTier[], count: number): PricingTier | null {
  for (const tier of tiers) {
    if (count >= tier.min_places && (tier.max_places === null || count <= tier.max_places)) {
      return tier;
    }
  }
  return null;
}

// ─── Tier Card ────────────────────────────────────────────────────────────────

interface TierCardProps {
  tier: PricingTier;
  isActive: boolean;
  index: number;
}

const TierCard: React.FC<TierCardProps> = React.memo(({ tier, isActive, index }) => (
  <Animated.View
    entering={FadeInDown.delay(index * 60).duration(300)}
    className={`rounded-xl px-4 py-3 mb-2 border ${
      isActive
        ? 'border-[rgba(201,168,76,0.5)] bg-[rgba(201,168,76,0.08)]'
        : 'border-white/[0.06] bg-surface-2'
    }`}
  >
    <View className="flex-row items-center justify-between">
      <View className="flex-1 gap-0.5">
        <Text
          className={`text-sm font-['MontserratAlternates-SemiBold'] ${
            isActive ? 'text-brand-gold' : 'text-parchment'
          }`}
        >
          {tier.label}
        </Text>
        <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular']">
          {tier.max_places
            ? `${tier.min_places}–${tier.max_places} places`
            : `${tier.min_places}+ places`}
        </Text>
      </View>
      <Text
        className={`text-sm font-['MontserratAlternates-SemiBold'] ${
          isActive ? 'text-brand-gold' : 'text-parchment-muted'
        }`}
      >
        {formatInr(tier.price_per_place_paise)}/place
      </Text>
    </View>
  </Animated.View>
));
TierCard.displayName = 'TierCard';

// ─── Place Card ───────────────────────────────────────────────────────────────

interface PlaceSelectCardProps {
  place: { id: string; name: string; categories: string[]; distance_meters: number; place_type?: string; formatted: string; city: string; country: string };
  isSelected: boolean;
  index: number;
  onToggle: (id: string) => void;
}

const PlaceSelectCard: React.FC<PlaceSelectCardProps> = React.memo(
  ({ place, isSelected, index, onToggle }) => {
    const fallbackUri = getPlaceImage(place.categories);
    const distanceKm = (place.distance_meters / 1000).toFixed(1);

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <TouchableOpacity
          onPress={() => onToggle(place.id)}
          activeOpacity={0.85}
          className={`flex-row items-center rounded-2xl p-3 mb-2 border ${
            isSelected
              ? 'border-[rgba(201,168,76,0.45)] bg-[rgba(201,168,76,0.06)]'
              : 'border-white/[0.08] bg-surface-1'
          }`}
        >
          {/* Thumbnail */}
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country}`}
            fallbackUri={fallbackUri}
            style={{ width: 56, height: 56, borderRadius: 12 }}
            imageStyle={{ width: 56, height: 56, borderRadius: 12 }}
            loadingLabel=""
          />

          {/* Info */}
          <View className="flex-1 ml-3">
            <Text
              className="text-parchment text-sm font-['MontserratAlternates-SemiBold']"
              numberOfLines={1}
            >
              {place.name}
            </Text>
            <Text
              className="text-parchment-dim text-xs font-['MontserratAlternates-Regular'] mt-0.5"
              numberOfLines={1}
            >
              {place.place_type
                ? formatPlaceType(place.place_type)
                : place.city}
            </Text>
          </View>

          {/* Distance */}
          <View className="flex-row items-center gap-1 mr-3">
            <Compass color="#6B6357" size={11} />
            <Text className="text-parchment-dim text-[11px] font-['MontserratAlternates-Medium']">
              {distanceKm} km
            </Text>
          </View>

          {/* Checkbox */}
          <View
            className={`w-6 h-6 rounded-md border items-center justify-center ${
              isSelected
                ? 'bg-brand-gold border-brand-gold'
                : 'border-white/20 bg-transparent'
            }`}
          >
            {isSelected && <Check color="#0A0A0A" size={14} />}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);
PlaceSelectCard.displayName = 'PlaceSelectCard';

// ─── Screen ───────────────────────────────────────────────────────────────────

const PurchaseScreen: React.FC<Props> = ({ navigation, route }) => {
  const preSelectedPlaceId = route.params?.preSelectedPlaceId;

  // Config
  const [config, setConfig] = useState<ExplorerPassConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<{
    message: string;
    statusCode: number;
  } | null>(null);

  // Place selection
  const nearbyPlaces = usePlacesStore(s => s.nearbyPlaces);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(
    () => new Set(preSelectedPlaceId ? [preSelectedPlaceId] : []),
  );

  // Coupon
  const [couponInput, setCouponInput] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);
  const [quote, setQuote] = useState<ExplorerPassQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const appliedCoupon = couponResult?.is_valid ? couponResult.code : undefined;
  const discountPercent = couponResult?.is_valid ? couponResult.discount_percent ?? 0 : 0;

  // Purchase
  const { purchasing, purchase } = useExplorerPassPurchase();
  const { refresh: refreshPasses, passes, hasAnyActivePass } = useExplorerPass();

  // Load config (extracted so the error screen can retry)
  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setConfigError(null);
    const result = await getExplorerPassConfig();
    if (result.success) {
      setConfig(result.data);
    } else {
      setConfig(null);
      setConfigError(result.error);
      if (__DEV__) {
        console.warn(
          '[PurchaseScreen] explorer-pass/config failed',
          result.error,
        );
      }
    }
    setLoadingConfig(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadConfig();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadConfig]);

  // Tier matching
  const selectedCount = selectedPlaceIds.size;
  const sortedTiers = useMemo(
    () => (config?.tiers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [config],
  );
  const matchedTier = useMemo(
    () => (selectedCount > 0 ? findTierForCount(sortedTiers, selectedCount) : null),
    [sortedTiers, selectedCount],
  );

  // Server-computed quote (per-place override-aware). Debounced 300ms.
  useEffect(() => {
    if (selectedCount === 0) {
      setQuote(null);
      return;
    }
    const placeIds = Array.from(selectedPlaceIds);
    let cancelled = false;
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      const res = await getExplorerPassQuote(placeIds);
      if (cancelled) return;
      if (res.success) {
        setQuote(res.data);
      } else {
        setQuote(null);
      }
      setQuoteLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedCount, selectedPlaceIds]);

  // Pricing — prefer server quote; fall back to client tier math until quote arrives.
  const fallbackPricePerPlace = matchedTier?.price_per_place_paise ?? 0;
  const fallbackSubtotal = fallbackPricePerPlace * selectedCount;
  const subtotalPaise = quote?.subtotal_paise ?? fallbackSubtotal;
  const pricePerPlacePaise =
    quote && selectedCount > 0
      ? Math.round(quote.subtotal_paise / selectedCount)
      : fallbackPricePerPlace;
  const discountPaise = discountPercent > 0 ? Math.round(subtotalPaise * discountPercent / 100) : 0;
  const totalPaise = Math.max(100, (quote?.total_paise ?? subtotalPaise) - discountPaise);
  const accessHours =
    quote?.max_access_hours ??
    (matchedTier && selectedCount === 1
      ? matchedTier.access_hours_single
      : matchedTier?.access_hours_multi ?? 0);

  // Handlers
  const togglePlace = useCallback((placeId: string) => {
    setSelectedPlaceIds(prev => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }, []);

  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
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
    if (selectedCount === 0) return;
    const placeIds = Array.from(selectedPlaceIds);
    const pass = await purchase(placeIds, appliedCoupon);
    if (pass) {
      await refreshPasses();
      navigation.goBack();
    }
  }, [appliedCoupon, navigation, purchase, refreshPasses, selectedCount, selectedPlaceIds]);

  // Loading state
  if (loadingConfig) {
    return (
      <SafeAreaView className="flex-1 bg-ink-deep items-center justify-center">
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#D4860A" size="large" />
        <Text className="text-parchment-muted text-sm font-['MontserratAlternates-Regular'] mt-3">
          Loading Explorer Pass...
        </Text>
      </SafeAreaView>
    );
  }

  // Error state — resilient: retry, active-pass handoff, support link
  if (!config || sortedTiers.length === 0) {
    const activePass = passes.find(p => p.is_active);
    const isServerError = configError && configError.statusCode >= 500;
    const title = hasAnyActivePass
      ? 'Your Explorer Pass is active'
      : isServerError
        ? 'Our servers are taking a breather'
        : 'Unable to load Explorer Pass';

    const body = hasAnyActivePass
      ? `You already have an active pass${
          activePass ? ` for ${activePass.place_count} place${activePass.place_count > 1 ? 's' : ''}` : ''
        }. Pricing options aren't available right now, but your access is unaffected.`
      : configError
        ? 'We couldn’t reach pricing right now. Please retry in a moment.'
        : 'No pricing tiers are configured. Please try again later.';

    return (
      <SafeAreaView className="flex-1 bg-ink-deep items-center justify-center px-8">
        <StatusBar barStyle="light-content" />
        <View
          className={`w-14 h-14 rounded-full items-center justify-center mb-5 ${
            hasAnyActivePass
              ? 'bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.35)]'
              : 'bg-[rgba(201,168,76,0.12)] border border-[rgba(201,168,76,0.3)]'
          }`}
        >
          {hasAnyActivePass ? (
            <Shield color="#10B981" size={22} />
          ) : (
            <Sparkles color="#C9A84C" size={22} />
          )}
        </View>

        <Text className="text-parchment text-lg text-center font-['MontserratAlternates-SemiBold']">
          {title}
        </Text>
        <Text className="text-parchment-dim text-sm text-center mt-2 font-['MontserratAlternates-Regular'] max-w-[320px]">
          {body}
        </Text>

        {__DEV__ && configError && (
          <Text className="text-parchment-dim/70 text-[11px] text-center mt-3 font-['MontserratAlternates-Regular']">
            {`dev: ${configError.statusCode} \u2014 ${configError.message}`}
          </Text>
        )}

        <View className="flex-row items-center gap-3 mt-6">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="px-5 py-3 rounded-xl bg-surface-1 border border-white/10"
          >
            <Text className="text-parchment text-sm font-['MontserratAlternates-Medium']">
              Go back
            </Text>
          </TouchableOpacity>

          {!hasAnyActivePass && (
            <TouchableOpacity
              onPress={loadConfig}
              disabled={loadingConfig}
              className="px-5 py-3 rounded-xl bg-brand-gold flex-row items-center gap-2"
            >
              <RefreshCw color="#0A0A0A" size={14} />
              <Text className="text-ink text-sm font-['MontserratAlternates-SemiBold']">
                {loadingConfig ? 'Retrying…' : 'Retry'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!hasAnyActivePass && (
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                'mailto:support@epocheye.com?subject=Explorer%20Pass%20unavailable',
              )
            }
            className="mt-4"
          >
            <Text className="text-brand-gold text-xs font-['MontserratAlternates-Medium'] underline">
              Contact support
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

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
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>
          <Text className="text-parchment text-xl font-['MontserratAlternates-Bold']">
            Explorer Pass
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <Animated.View
            entering={FadeIn.duration(400)}
            className="bg-surface-1 rounded-2xl border border-[rgba(212,134,10,0.25)] p-5 mb-5"
          >
            <View className="flex-row items-center gap-2 mb-3">
              <Sparkles color="#D4860A" size={16} />
              <Text className="text-brand-amber text-xs uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                Explorer Pass
              </Text>
            </View>
            <Text className="text-parchment text-[22px] leading-7 font-['MontserratAlternates-Bold']">
              Unlock Heritage Sites Near You
            </Text>
            <Text className="text-parchment-muted text-sm leading-5 mt-2 font-['MontserratAlternates-Regular']">
              Select the places you want to explore. The more you pick, the less you pay per place.
            </Text>

            {/* Tier pricing list */}
            <View className="mt-4">
              {sortedTiers.map((tier, idx) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  isActive={matchedTier?.id === tier.id}
                  index={idx}
                />
              ))}
            </View>
          </Animated.View>

          {/* Place selection */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text className="text-parchment text-base font-['MontserratAlternates-SemiBold'] mb-3">
              Select Places
            </Text>

            {nearbyPlaces.length === 0 ? (
              <View className="items-center py-8 gap-2">
                <MapPin color="#6B6357" size={24} />
                <Text className="text-parchment-dim text-sm text-center font-['MontserratAlternates-Regular']">
                  No nearby places found. Move closer to a heritage area.
                </Text>
              </View>
            ) : (
              nearbyPlaces.map((place, idx) => (
                <PlaceSelectCard
                  key={place.id}
                  place={place}
                  isSelected={selectedPlaceIds.has(place.id)}
                  index={idx}
                  onToggle={togglePlace}
                />
              ))
            )}
          </Animated.View>

          {/* Price Summary */}
          {selectedCount > 0 && matchedTier && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="bg-surface-1 rounded-2xl border border-white/[0.08] p-4 mt-3 mb-4"
            >
              <Text className="text-parchment text-base font-['MontserratAlternates-SemiBold'] mb-3">
                Price Summary
              </Text>

              <View className="flex-row justify-between mb-2">
                <Text className="text-parchment-muted text-sm font-['MontserratAlternates-Regular']">
                  {selectedCount} place{selectedCount > 1 ? 's' : ''} x{' '}
                  {formatInr(pricePerPlacePaise)}
                </Text>
                <Text className="text-parchment text-sm font-['MontserratAlternates-SemiBold']">
                  {formatInr(subtotalPaise)}
                </Text>
              </View>

              <View className="flex-row justify-between mb-2">
                <Text className="text-parchment-muted text-sm font-['MontserratAlternates-Regular']">
                  Tier
                </Text>
                <Text className="text-brand-gold text-sm font-['MontserratAlternates-SemiBold']">
                  {matchedTier.label}
                </Text>
              </View>

              <View className="flex-row justify-between mb-2">
                <Text className="text-parchment-muted text-sm font-['MontserratAlternates-Regular']">
                  Access Duration
                </Text>
                <Text className="text-parchment text-sm font-['MontserratAlternates-SemiBold']">
                  {formatAccessDuration(accessHours)}
                </Text>
              </View>

              {discountPaise > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-status-success text-sm font-['MontserratAlternates-Regular']">
                    Coupon ({discountPercent}% off)
                  </Text>
                  <Text className="text-status-success text-sm font-['MontserratAlternates-SemiBold']">
                    -{formatInr(discountPaise)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between mt-1 pt-3 border-t border-white/[0.08]">
                <Text className="text-parchment text-base font-['MontserratAlternates-Bold']">
                  Total
                </Text>
                <Text className="text-parchment text-xl font-['MontserratAlternates-Bold']">
                  {formatInr(totalPaise)}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Coupon section */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(350)}
            className="bg-surface-1 border border-white/[0.08] rounded-2xl p-4 mb-4"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Tag color="#C9A84C" size={13} />
              <Text className="text-parchment-muted text-xs font-['MontserratAlternates-Medium']">
                Have a promo code?
              </Text>
            </View>

            {couponResult?.is_valid ? (
              <View className="flex-row items-center justify-between bg-status-success/10 border border-status-success/20 rounded-xl px-3 py-2.5">
                <View className="flex-row items-center gap-2">
                  <Check color="#10B981" size={14} />
                  <Text className="text-status-success text-sm font-['MontserratAlternates-SemiBold']">
                    {couponResult.code} · {couponResult.discount_percent}% off
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
                    if (couponResult) setCouponResult(null);
                  }}
                  placeholder="Enter code"
                  placeholderTextColor="rgba(245,240,232,0.25)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleApplyCoupon}
                  className="flex-1 bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-parchment text-sm font-['MontserratAlternates-Regular']"
                />
                <TouchableOpacity
                  onPress={handleApplyCoupon}
                  disabled={couponValidating || !couponInput.trim()}
                  className="bg-brand-gold/20 border border-brand-gold/30 rounded-xl px-4 items-center justify-center"
                >
                  {couponValidating ? (
                    <ActivityIndicator color="#C9A84C" size="small" />
                  ) : (
                    <Text className="text-brand-gold text-sm font-['MontserratAlternates-SemiBold']">
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
          </Animated.View>

          {/* Purchase button */}
          <Animated.View entering={FadeInDown.delay(250).duration(350)}>
            <TouchableOpacity
              onPress={handlePurchase}
              disabled={purchasing || selectedCount === 0}
              className={`py-4 rounded-2xl items-center justify-center flex-row gap-2 ${
                selectedCount === 0 ? 'opacity-45' : ''
              }`}
              style={{ backgroundColor: '#D4860A' }}
              accessibilityRole="button"
            >
              {purchasing ? (
                <ActivityIndicator color="#0A0A0A" size="small" />
              ) : (
                <>
                  <Sparkles color="#0A0A0A" size={18} />
                  <Text className="text-ink text-base font-['MontserratAlternates-Bold']">
                    {selectedCount === 0
                      ? 'Select Places to Continue'
                      : `Get Explorer Pass · ${formatInr(totalPaise)}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1.5 mt-3 mb-2">
              <Shield color="#6B6357" size={12} />
              <Text className="text-parchment-dim text-xs font-['MontserratAlternates-Regular']">
                Secure checkout via Razorpay · One-time payment
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default PurchaseScreen;
