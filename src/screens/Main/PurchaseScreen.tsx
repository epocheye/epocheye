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
  Clock3,
  Compass,
  MapPin,
  Search,
  Shield,
  Sparkles,
  Tag,
  X,
} from 'lucide-react-native';
import { validateCoupon } from '../../utils/api/coupons';
import type { CouponValidation } from '../../utils/api/coupons';
import {
  getExplorerPassQuote,
  type ExplorerPassQuote,
} from '../../utils/api/explorer-pass';
import { useExplorerPass, useExplorerPassPurchase } from '../../shared/hooks';
import { usePlacesStore } from '../../stores/placesStore';
import { getSites } from '../../utils/api/places';
import type { SiteDetail } from '../../utils/api/places';
import { formatPlaceType } from '../../shared/utils/formatters';
import type { MainScreenProps } from '../../core/types/navigation.types';

type Props = MainScreenProps<'Purchase'>;

const DURATION_OPTIONS = [24, 48, 72] as const;
type Duration = (typeof DURATION_OPTIONS)[number];

function formatInr(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? 's' : ''}`;
}

interface SelectablePlace {
  id: string;
  name: string;
  categories: string[];
  distance_meters: number;
  place_type?: string;
  formatted: string;
  city: string;
  country: string;
}

function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Maps a curated Epocheye site into the pass-selection card shape. */
function siteToSelectable(
  site: SiteDetail,
  userLoc: { latitude: number; longitude: number } | null,
): SelectablePlace {
  const categories = [site.era, site.dynasty, site.architectural_style].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );
  const distance =
    userLoc &&
    typeof site.latitude === 'number' &&
    typeof site.longitude === 'number'
      ? distanceMeters(
          userLoc.latitude,
          userLoc.longitude,
          site.latitude,
          site.longitude,
        )
      : 0;
  return {
    id: site.slug ?? site.id,
    name: site.name,
    categories,
    distance_meters: distance,
    place_type: site.architectural_style,
    formatted:
      site.one_line_description ||
      [site.city, site.state].filter(Boolean).join(', '),
    city: site.city ?? '',
    country: site.country ?? '',
  };
}

interface PlaceSelectCardProps {
  place: SelectablePlace;
  isSelected: boolean;
  index: number;
  onToggle: (id: string) => void;
}

const PlaceSelectCard: React.FC<PlaceSelectCardProps> = React.memo(
  ({ place, isSelected, index, onToggle }) => {
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
          <View className="flex-1">
            <Text
              className="text-parchment text-sm font-['InstrumentSans-SemiBold']"
              numberOfLines={1}
            >
              {place.name}
            </Text>
            <Text
              className="text-parchment-dim text-xs font-['InstrumentSans-Regular'] mt-0.5"
              numberOfLines={1}
            >
              {place.place_type
                ? formatPlaceType(place.place_type)
                : place.city}
            </Text>
          </View>

          <View className="flex-row items-center gap-1 mr-3">
            <Compass color="#6B6357" size={11} />
            <Text className="text-parchment-dim text-[11px] font-['InstrumentSans-Medium']">
              {distanceKm} km
            </Text>
          </View>

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

const PurchaseScreen: React.FC<Props> = ({ navigation, route }) => {
  const preSelectedPlaceId = route.params?.preSelectedPlaceId;

  const currentLocation = usePlacesStore(s => s.currentLocation);
  const [sites, setSites] = useState<SiteDetail[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [siteSearch, setSiteSearch] = useState('');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(
    () => new Set(preSelectedPlaceId ? [preSelectedPlaceId] : []),
  );
  const [durationHours, setDurationHours] = useState<Duration>(24);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getSites();
      if (cancelled) return;
      if (result.success) setSites(result.data);
      setSitesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [couponInput, setCouponInput] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(
    null,
  );
  const appliedCoupon = couponResult?.is_valid ? couponResult.code : undefined;

  const [quote, setQuote] = useState<ExplorerPassQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const { purchasing, purchase } = useExplorerPassPurchase();
  const { refresh: refreshPasses } = useExplorerPass();

  const selectedCount = selectedPlaceIds.size;
  const isSingle = selectedCount === 1;
  const isBundle = selectedCount >= 2;

  const selectablePlaces = useMemo(
    () => sites.map(s => siteToSelectable(s, currentLocation)),
    [sites, currentLocation],
  );

  const placeNameById = useMemo(
    () => Object.fromEntries(selectablePlaces.map(p => [p.id, p.name])),
    [selectablePlaces],
  );

  // When the user arrived from a specific site's "Get Passport" CTA, focus the
  // flow on just that site. Otherwise show the full searchable catalogue.
  const focusedPlace = useMemo(() => {
    if (!preSelectedPlaceId) return null;
    return selectablePlaces.find(p => p.id === preSelectedPlaceId) ?? null;
  }, [preSelectedPlaceId, selectablePlaces]);

  const isFocused = !!focusedPlace;

  const visiblePlaces = useMemo(() => {
    if (isFocused && focusedPlace) return [focusedPlace];
    const q = siteSearch.trim().toLowerCase();
    if (!q) return selectablePlaces;
    return selectablePlaces.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q),
    );
  }, [isFocused, focusedPlace, selectablePlaces, siteSearch]);

  // Server-authoritative quote, 300ms debounce.
  useEffect(() => {
    if (selectedCount === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const placeIds = Array.from(selectedPlaceIds);
    let cancelled = false;
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      const res = await getExplorerPassQuote(placeIds, {
        durationHours: isBundle ? durationHours : undefined,
        couponCode: appliedCoupon,
      });
      if (cancelled) return;
      if (res.success) {
        setQuote(res.data);
        setQuoteError(null);
      } else {
        setQuote(null);
        setQuoteError(res.error.message);
      }
      setQuoteLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedCount, selectedPlaceIds, durationHours, appliedCoupon, isBundle]);

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
    const pass = await purchase(placeIds, {
      durationHours: isBundle ? durationHours : undefined,
      couponCode: appliedCoupon,
    });
    if (pass) {
      await refreshPasses();
      navigation.goBack();
    }
  }, [
    appliedCoupon,
    durationHours,
    isBundle,
    navigation,
    purchase,
    refreshPasses,
    selectedCount,
    selectedPlaceIds,
  ]);

  const totalPaise = quote?.total_paise ?? 0;
  const subtotalPaise = quote?.subtotal_paise ?? 0;
  const extensionPaise = quote?.extension_paise ?? 0;
  const discountPaise = quote?.discount_amount_paise ?? 0;
  const accessHours = quote?.access_hours ?? (isSingle ? 12 : durationHours);

  return (
    <SafeAreaView className="flex-1 bg-ink-deep">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#000000', '#0C0A07', '#000000']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-surface-1 border border-white/10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>
          <Text className="text-parchment text-xl font-['InstrumentSerif-Regular']">
            {isBundle ? 'Build Your Pass' : 'Get Access'}
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Animated.View
            entering={FadeIn.duration(400)}
            className="bg-surface-1 rounded-2xl border border-[rgba(212,134,10,0.25)] p-5 mb-5"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Sparkles color="#D4860A" size={16} />
              <Text className="text-brand-amber text-xs uppercase tracking-[0.8px] font-['InstrumentSans-SemiBold']">
                {isBundle ? 'Custom Passport' : 'Single Place Access'}
              </Text>
            </View>
            <Text className="text-parchment text-[22px] leading-7 font-['InstrumentSerif-Regular']">
              {isBundle
                ? 'Unlock multiple heritage sites'
                : isSingle
                ? 'Unlock this heritage site'
                : 'Pick places to unlock'}
            </Text>
            <Text className="text-parchment-muted text-sm leading-5 mt-2 font-['InstrumentSans-Regular']">
              {isBundle
                ? `Your pass is built from the places you select. Default 24 hours; extendable up to 3 days. We'll notify you before access ends.`
                : `Every place has 12 hours of access from the moment you buy it. Pick two or more to build a custom Passport and save time.`}
            </Text>
          </Animated.View>

          {/* Place selection — sourced from our curated Epocheye sites only. */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text className="text-parchment text-base font-['InstrumentSans-SemiBold'] mb-3">
              {isFocused ? 'Your Selection' : 'Select Places'}
            </Text>

            {!isFocused && (
              <View className="flex-row items-center bg-surface-2 border border-white/10 rounded-xl px-3 mb-3">
                <Search color="#6B6357" size={16} />
                <TextInput
                  value={siteSearch}
                  onChangeText={setSiteSearch}
                  placeholder="Search Epocheye sites"
                  placeholderTextColor="rgba(245,240,232,0.25)"
                  autoCorrect={false}
                  className="flex-1 py-2.5 px-2 text-parchment text-sm font-['InstrumentSans-Regular']"
                />
                {siteSearch.length > 0 ? (
                  <TouchableOpacity onPress={() => setSiteSearch('')} hitSlop={8}>
                    <X color="#6B6357" size={14} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {sitesLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#C9A84C" size="small" />
              </View>
            ) : visiblePlaces.length === 0 ? (
              <View className="items-center py-8 gap-2">
                <MapPin color="#6B6357" size={24} />
                <Text className="text-parchment-dim text-sm text-center font-['InstrumentSans-Regular']">
                  {siteSearch.trim()
                    ? 'No Epocheye sites match your search.'
                    : 'No Epocheye sites are available yet.'}
                </Text>
              </View>
            ) : (
              visiblePlaces.map((place, idx) => (
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

          {/* Duration picker (bundles only) */}
          {isBundle && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="bg-surface-1 rounded-2xl border border-white/[0.08] p-4 mt-3 mb-4"
            >
              <View className="flex-row items-center gap-2 mb-3">
                <Clock3 color="#C9A84C" size={14} />
                <Text className="text-parchment text-sm font-['InstrumentSans-SemiBold']">
                  Pass Duration
                </Text>
              </View>
              <View className="flex-row gap-2">
                {DURATION_OPTIONS.map(h => (
                  <TouchableOpacity
                    key={h}
                    onPress={() => setDurationHours(h)}
                    className={`flex-1 py-3 rounded-xl border items-center ${
                      durationHours === h
                        ? 'border-brand-gold bg-[rgba(201,168,76,0.1)]'
                        : 'border-white/[0.08] bg-surface-2'
                    }`}
                  >
                    <Text
                      className={`text-sm font-['InstrumentSans-SemiBold'] ${
                        durationHours === h
                          ? 'text-brand-gold'
                          : 'text-parchment'
                      }`}
                    >
                      {formatDuration(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {durationHours > 24 && (
                <Text className="text-parchment-dim text-xs mt-2 font-['InstrumentSans-Regular']">
                  Extension fee applies — see summary below.
                </Text>
              )}
            </Animated.View>
          )}

          {/* Single-place access notice */}
          {isSingle && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="bg-surface-1 rounded-2xl border border-white/[0.08] p-4 mt-3 mb-4"
            >
              <View className="flex-row items-center gap-2 mb-1.5">
                <Clock3 color="#C9A84C" size={14} />
                <Text className="text-parchment text-sm font-['InstrumentSans-SemiBold']">
                  12 hours of access
                </Text>
              </View>
              <Text className="text-parchment-dim text-xs leading-[18px] font-['InstrumentSans-Regular']">
                You'll have 12 hours to explore. We'll remind you 1 hour and 15
                minutes before it ends.
              </Text>
            </Animated.View>
          )}

          {/* Price Summary */}
          {selectedCount > 0 && quote && !quoteLoading && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              className="bg-surface-1 rounded-2xl border border-white/[0.08] p-4 mb-4"
            >
              <Text className="text-parchment text-base font-['InstrumentSans-SemiBold'] mb-3">
                Price Summary
              </Text>

              {quote.line_items.map(li => (
                <View
                  key={li.place_id}
                  className="flex-row justify-between mb-2"
                >
                  <Text
                    className="text-parchment-muted text-sm font-['InstrumentSans-Regular'] flex-1 pr-3"
                    numberOfLines={1}
                  >
                    {li.place_name ||
                      placeNameById[li.place_id] ||
                      'Selected place'}
                  </Text>
                  <Text className="text-parchment text-sm font-['InstrumentSans-SemiBold']">
                    {formatInr(li.price_paise)}
                  </Text>
                </View>
              ))}

              <View className="flex-row justify-between mt-1 pt-2 border-t border-white/[0.05]">
                <Text className="text-parchment-muted text-sm font-['InstrumentSans-Regular']">
                  Access Duration
                </Text>
                <Text className="text-parchment text-sm font-['InstrumentSans-SemiBold']">
                  {formatDuration(accessHours)}
                </Text>
              </View>

              {discountPaise > 0 && (
                <View className="flex-row justify-between mb-1 mt-1">
                  <Text className="text-status-success text-sm font-['InstrumentSans-Regular']">
                    Coupon ({quote.discount_percent ?? 0}% off)
                  </Text>
                  <Text className="text-status-success text-sm font-['InstrumentSans-SemiBold']">
                    -{formatInr(discountPaise)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between mt-2 pt-3 border-t border-white/[0.08]">
                <Text className="text-parchment text-base font-['InstrumentSerif-Regular']">
                  Total
                </Text>
                <Text className="text-parchment text-xl font-['InstrumentSerif-Regular']">
                  {formatInr(totalPaise)}
                </Text>
              </View>

              {extensionPaise === 0 && subtotalPaise > 0 && isBundle && (
                <Text className="text-parchment-dim text-[11px] mt-2 font-['InstrumentSans-Regular']">
                  Subtotal {formatInr(subtotalPaise)}
                </Text>
              )}
            </Animated.View>
          )}

          {selectedCount > 0 && quoteLoading && !quote && (
            <View className="items-center py-4 mb-4">
              <ActivityIndicator color="#C9A84C" size="small" />
            </View>
          )}

          {quoteError && (
            <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
              <Text className="text-red-400 text-xs font-['InstrumentSans-Regular']">
                {quoteError}
              </Text>
            </View>
          )}

          {/* Coupon section */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(350)}
            className="bg-surface-1 border border-white/[0.08] rounded-2xl p-4 mb-4"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <Tag color="#C9A84C" size={13} />
              <Text className="text-parchment-muted text-xs font-['InstrumentSans-Medium']">
                Have a promo code?
              </Text>
            </View>

            {couponResult?.is_valid ? (
              <View className="flex-row items-center justify-between bg-status-success/10 border border-status-success/20 rounded-xl px-3 py-2.5">
                <View className="flex-row items-center gap-2">
                  <Check color="#10B981" size={14} />
                  <Text className="text-status-success text-sm font-['InstrumentSans-SemiBold']">
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
                  className="flex-1 bg-surface-2 border border-white/10 rounded-xl px-3 py-2.5 text-parchment text-sm font-['InstrumentSans-Regular']"
                />
                <TouchableOpacity
                  onPress={handleApplyCoupon}
                  disabled={couponValidating || !couponInput.trim()}
                  className="bg-brand-gold/20 border border-brand-gold/30 rounded-xl px-4 items-center justify-center"
                >
                  {couponValidating ? (
                    <ActivityIndicator color="#C9A84C" size="small" />
                  ) : (
                    <Text className="text-brand-gold text-sm font-['InstrumentSans-SemiBold']">
                      Apply
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {couponResult && !couponResult.is_valid && (
              <Text className="text-red-400 text-xs mt-2 font-['InstrumentSans-Regular']">
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
              disabled={purchasing || selectedCount === 0 || !quote}
              className={`py-4 rounded-2xl items-center justify-center flex-row gap-2 ${
                selectedCount === 0 || !quote ? 'opacity-45' : ''
              }`}
              style={{ backgroundColor: '#D4860A' }}
              accessibilityRole="button"
            >
              {purchasing ? (
                <ActivityIndicator color="#0A0A0A" size="small" />
              ) : (
                <>
                  <Sparkles color="#0A0A0A" size={18} />
                  <Text className="text-ink text-base font-['InstrumentSerif-Regular']">
                    {selectedCount === 0
                      ? 'Select a place to continue'
                      : quote
                      ? `Confirm · ${formatInr(totalPaise)}`
                      : 'Calculating…'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1.5 mt-3 mb-2">
              <Shield color="#6B6357" size={12} />
              <Text className="text-parchment-dim text-xs font-['InstrumentSans-Regular']">
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
