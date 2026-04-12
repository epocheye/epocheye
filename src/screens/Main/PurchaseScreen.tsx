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
import {
  ArrowLeft,
  Check,
  MapPin,
  Sparkles,
  Tag,
  X,
} from 'lucide-react-native';
import { validateCoupon } from '../../utils/api/tours';
import type { CouponValidation } from '../../utils/api/tours';
import {
  getExplorerPassConfig,
  type ExplorerPassConfig,
  type PricingTier,
} from '../../utils/api/explorer-pass';
import {
  useExplorerPass,
  useExplorerPassPurchase,
} from '../../shared/hooks';
import { usePlacesStore } from '../../stores/placesStore';
import { formatPlaceType } from '../../shared/utils/formatters';
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

const PurchaseScreen: React.FC<Props> = ({ navigation, route }) => {
  const preSelectedPlaceId = route.params?.preSelectedPlaceId;

  // ─── Config ───
  const [config, setConfig] = useState<ExplorerPassConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ─── Place selection ───
  const nearbyPlaces = usePlacesStore(s => s.nearbyPlaces);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(
    () => new Set(preSelectedPlaceId ? [preSelectedPlaceId] : []),
  );

  // ─── Coupon ───
  const [couponInput, setCouponInput] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);
  const appliedCoupon = couponResult?.is_valid ? couponResult.code : undefined;
  const discountPercent = couponResult?.is_valid ? couponResult.discount_percent ?? 0 : 0;

  // ─── Purchase ───
  const { purchasing, purchase } = useExplorerPassPurchase();
  const { refresh: refreshPasses } = useExplorerPass();

  // ─── Load config ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingConfig(true);
      const result = await getExplorerPassConfig();
      if (!cancelled && result.success) setConfig(result.data);
      if (!cancelled) setLoadingConfig(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Tier matching ───
  const selectedCount = selectedPlaceIds.size;
  const sortedTiers = useMemo(
    () => (config?.tiers ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [config],
  );
  const matchedTier = useMemo(
    () => (selectedCount > 0 ? findTierForCount(sortedTiers, selectedCount) : null),
    [sortedTiers, selectedCount],
  );

  // ─── Pricing ───
  const pricePerPlacePaise = matchedTier?.price_per_place_paise ?? 0;
  const subtotalPaise = pricePerPlacePaise * selectedCount;
  const discountPaise = discountPercent > 0 ? Math.round(subtotalPaise * discountPercent / 100) : 0;
  const totalPaise = Math.max(100, subtotalPaise - discountPaise);
  const accessHours =
    matchedTier && selectedCount === 1
      ? matchedTier.access_hours_single
      : matchedTier?.access_hours_multi ?? 0;

  // ─── Handlers ───
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

  // ─── Loading ───
  if (loadingConfig) {
    return (
      <SafeAreaView style={s.safeCenter}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#D4860A" size="large" />
        <Text style={s.loadingText}>Loading Explorer Pass...</Text>
      </SafeAreaView>
    );
  }

  if (!config || sortedTiers.length === 0) {
    return (
      <SafeAreaView style={s.safeCenter}>
        <StatusBar barStyle="light-content" />
        <Text style={s.errorTitle}>Something went wrong</Text>
        <Text style={s.errorBody}>Unable to load Explorer Pass details. Please try again later.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.goBackBtn}>
          <Text style={s.goBackText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0A', '#14110B', '#0A0A0A']}
        locations={[0, 0.5, 1]}
        style={s.gradient}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Explorer Pass</Text>
        </View>

        <ScrollView
          style={s.flex1}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Tier Overview */}
          <View style={s.tierOverviewCard}>
            <View style={s.tierOverviewHeader}>
              <Sparkles color="#D4860A" size={16} />
              <Text style={s.tierOverviewLabel}>Explorer Pass</Text>
            </View>
            <Text style={s.tierOverviewTitle}>
              Unlock Heritage Sites Near You
            </Text>
            <Text style={s.tierOverviewBody}>
              Select the places you want to explore. The more you pick, the less you pay per place.
            </Text>

            {/* Tier pricing preview */}
            <View style={s.tierList}>
              {sortedTiers.map(tier => {
                const isActive = matchedTier?.id === tier.id;
                return (
                  <View
                    key={tier.id}
                    style={[s.tierRow, isActive && s.tierRowActive]}
                  >
                    <View style={s.tierRowLeft}>
                      <Text style={[s.tierLabel, isActive && s.tierLabelActive]}>
                        {tier.label}
                      </Text>
                      <Text style={s.tierRange}>
                        {tier.max_places
                          ? `${tier.min_places}–${tier.max_places} places`
                          : `${tier.min_places}+ places`}
                      </Text>
                    </View>
                    <Text style={[s.tierPrice, isActive && s.tierPriceActive]}>
                      {formatInr(tier.price_per_place_paise)}/place
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Place Selection */}
          <Text style={s.sectionTitle}>Select Places</Text>
          {nearbyPlaces.length === 0 ? (
            <View style={s.emptyPlaces}>
              <MapPin color="#6B6357" size={24} />
              <Text style={s.emptyText}>
                No nearby places found. Move closer to a heritage area.
              </Text>
            </View>
          ) : (
            nearbyPlaces.map(place => {
              const isSelected = selectedPlaceIds.has(place.id);
              return (
                <TouchableOpacity
                  key={place.id}
                  onPress={() => togglePlace(place.id)}
                  style={[s.placeCard, isSelected && s.placeCardSelected]}
                  activeOpacity={0.8}
                >
                  <View style={s.placeCardLeft}>
                    <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
                      {isSelected && <Check color="#0A0A0A" size={14} />}
                    </View>
                    <View style={s.placeInfo}>
                      <Text style={s.placeName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text style={s.placeLocation} numberOfLines={1}>
                        {place.place_type
                          ? formatPlaceType(place.place_type)
                          : place.formatted}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.placeDistance}>
                    {(place.distance_meters / 1000).toFixed(1)} km
                  </Text>
                </TouchableOpacity>
              );
            })
          )}

          {/* Price Summary */}
          {selectedCount > 0 && matchedTier && (
            <View style={s.summaryCard}>
              <Text style={s.summaryHeading}>Price Summary</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>
                  {selectedCount} place{selectedCount > 1 ? 's' : ''} x{' '}
                  {formatInr(pricePerPlacePaise)}
                </Text>
                <Text style={s.summaryValue}>{formatInr(subtotalPaise)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Tier</Text>
                <Text style={s.summaryTier}>{matchedTier.label}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Access Duration</Text>
                <Text style={s.summaryValue}>
                  {formatAccessDuration(accessHours)}
                </Text>
              </View>
              {discountPaise > 0 && (
                <View style={s.summaryRow}>
                  <Text style={s.discountLabel}>
                    Coupon ({discountPercent}% off)
                  </Text>
                  <Text style={s.discountValue}>
                    -{formatInr(discountPaise)}
                  </Text>
                </View>
              )}
              <View style={[s.summaryRow, s.totalRow]}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalValue}>{formatInr(totalPaise)}</Text>
              </View>
            </View>
          )}

          {/* Coupon Section */}
          <View style={s.couponCard}>
            <View style={s.couponHeader}>
              <Tag color="#C9A84C" size={13} />
              <Text style={s.couponHeaderText}>Have a promo code?</Text>
            </View>

            {couponResult?.is_valid ? (
              <View style={s.couponApplied}>
                <View style={s.couponAppliedLeft}>
                  <Check color="#10B981" size={14} />
                  <Text style={s.couponAppliedText}>
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
              <View style={s.couponInputRow}>
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
                  style={s.couponInput}
                />
                <TouchableOpacity
                  onPress={handleApplyCoupon}
                  disabled={couponValidating || !couponInput.trim()}
                  style={s.couponApplyBtn}
                >
                  {couponValidating ? (
                    <ActivityIndicator color="#C9A84C" size="small" />
                  ) : (
                    <Text style={s.couponApplyText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {couponResult && !couponResult.is_valid && (
              <Text style={s.couponError}>
                {couponResult.reason === 'expired'
                  ? 'This code has expired.'
                  : couponResult.reason === 'exhausted'
                  ? 'This code has reached its usage limit.'
                  : 'Invalid promo code. Please check and try again.'}
              </Text>
            )}
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={purchasing || selectedCount === 0}
            style={[
              s.purchaseBtn,
              selectedCount === 0 && s.purchaseBtnDisabled,
            ]}
            accessibilityRole="button"
          >
            {purchasing ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <>
                <Sparkles color="#0A0A0A" size={18} />
                <Text style={s.purchaseBtnText}>
                  {selectedCount === 0
                    ? 'Select Places to Continue'
                    : `Get Explorer Pass · ${formatInr(totalPaise)}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.secureText}>
            Secure checkout via Razorpay · One-time payment
          </Text>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const s = {
  safe: { flex: 1, backgroundColor: '#0A0A0A' } as const,
  safeCenter: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  } as const,
  gradient: { flex: 1 } as const,
  flex1: { flex: 1 } as const,
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 } as const,
  loadingText: {
    color: '#B8AF9E',
    fontSize: 14,
    marginTop: 12,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  errorTitle: {
    color: '#F5F0E8',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  errorBody: {
    color: '#6B6357',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  goBackBtn: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  } as const,
  goBackText: {
    color: '#F5F0E8',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Medium',
  } as const,

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  } as const,
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  headerTitle: {
    color: '#F5F0E8',
    fontSize: 20,
    fontFamily: 'MontserratAlternates-Bold',
  } as const,

  // Tier overview card
  tierOverviewCard: {
    backgroundColor: '#141414',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,134,10,0.25)',
    padding: 20,
    marginBottom: 20,
  } as const,
  tierOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  } as const,
  tierOverviewLabel: {
    color: '#D4860A',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  tierOverviewTitle: {
    color: '#F5F0E8',
    fontSize: 22,
    fontFamily: 'MontserratAlternates-Bold',
    lineHeight: 28,
  } as const,
  tierOverviewBody: {
    color: '#B8AF9E',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  tierList: {
    marginTop: 16,
    gap: 8,
  } as const,
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  } as const,
  tierRowActive: {
    borderColor: 'rgba(201,168,76,0.5)',
    backgroundColor: 'rgba(201,168,76,0.08)',
  } as const,
  tierRowLeft: { gap: 2, flex: 1 } as const,
  tierLabel: {
    color: '#F5F0E8',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  tierLabelActive: { color: '#E8C870' } as const,
  tierRange: {
    color: '#6B6357',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  tierPrice: {
    color: '#B8AF9E',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  tierPriceActive: { color: '#C9A84C' } as const,

  // Section title
  sectionTitle: {
    color: '#F5F0E8',
    fontSize: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
    marginBottom: 12,
  } as const,

  // Empty places
  emptyPlaces: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  } as const,
  emptyText: {
    color: '#6B6357',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'MontserratAlternates-Regular',
  } as const,

  // Place card
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141414',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  } as const,
  placeCardSelected: {
    borderColor: 'rgba(201,168,76,0.45)',
    backgroundColor: 'rgba(201,168,76,0.06)',
  } as const,
  placeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  } as const,
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  checkboxSelected: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  } as const,
  placeInfo: { flex: 1 } as const,
  placeName: {
    color: '#F5F0E8',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  placeLocation: {
    color: '#6B6357',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-Regular',
    marginTop: 2,
  } as const,
  placeDistance: {
    color: '#C9A84C',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,

  // Summary card
  summaryCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
  } as const,
  summaryHeading: {
    color: '#F5F0E8',
    fontSize: 16,
    fontFamily: 'MontserratAlternates-SemiBold',
    marginBottom: 12,
  } as const,
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  } as const,
  summaryLabel: {
    color: '#B8AF9E',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  summaryValue: {
    color: '#F5F0E8',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  summaryTier: {
    color: '#C9A84C',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  discountLabel: {
    color: '#10B981',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  discountValue: {
    color: '#10B981',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  totalRow: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginBottom: 0,
  } as const,
  totalLabel: {
    color: '#F5F0E8',
    fontSize: 16,
    fontFamily: 'MontserratAlternates-Bold',
  } as const,
  totalValue: {
    color: '#F5F0E8',
    fontSize: 20,
    fontFamily: 'MontserratAlternates-Bold',
  } as const,

  // Coupon card
  couponCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 16,
  } as const,
  couponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  } as const,
  couponHeaderText: {
    color: '#B8AF9E',
    fontSize: 12,
    fontFamily: 'MontserratAlternates-Medium',
  } as const,
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const,
  couponAppliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as const,
  couponAppliedText: {
    color: '#10B981',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
  } as const,
  couponInput: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F5F0E8',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  couponApplyBtn: {
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  couponApplyText: {
    color: '#C9A84C',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  } as const,
  couponError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,

  // Purchase button
  purchaseBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#D4860A',
  } as const,
  purchaseBtnDisabled: {
    opacity: 0.45,
  } as const,
  purchaseBtnText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontFamily: 'MontserratAlternates-Bold',
  } as const,
  secureText: {
    color: '#6B6357',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
};

export default PurchaseScreen;
