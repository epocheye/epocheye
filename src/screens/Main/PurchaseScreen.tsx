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
import { ArrowLeft, Check, Sparkles, Tag, X } from 'lucide-react-native';
import { validateCoupon } from '../../utils/api/tours';
import type { CouponValidation } from '../../utils/api/tours';
import { getPremiumConfig, type PremiumProductConfig } from '../../utils/api/premium';
import { usePremiumPass, usePremiumPurchase } from '../../shared/hooks';
import type { MainScreenProps } from '../../core/types/navigation.types';

type Props = MainScreenProps<'Purchase'>;

function formatInr(amount: number): string {
  return `₹${Math.round(amount)}`;
}

const PurchaseScreen: React.FC<Props> = ({ navigation }) => {
  const [config, setConfig] = useState<PremiumProductConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const { purchasing, purchase } = usePremiumPurchase();
  const { hasActivePass, refresh: refreshPass } = usePremiumPass();

  const [couponInput, setCouponInput] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidation | null>(null);

  const appliedCoupon = couponResult?.is_valid ? couponResult.code : undefined;
  const discountPercent = couponResult?.is_valid ? couponResult.discount_percent ?? 0 : 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingConfig(true);
      const result = await getPremiumConfig();
      if (!cancelled) {
        if (result.success) setConfig(result.data);
        setLoadingConfig(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    if (!config) return;
    const pass = await purchase(appliedCoupon);
    if (pass) {
      await refreshPass();
      navigation.goBack();
    }
  }, [appliedCoupon, config, navigation, purchase, refreshPass]);

  const basePrice = config?.price_inr ?? 0;
  const discountedPrice =
    discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice;
  const finalPrice = Math.max(1, Math.round(discountedPrice));

  if (loadingConfig) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0A0A] items-center justify-center">
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#D4860A" size="large" />
        <Text className="text-[#B8AF9E] text-sm mt-3 font-['MontserratAlternates-Regular']">
          Loading…
        </Text>
      </SafeAreaView>
    );
  }

  if (!config) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0A0A] items-center justify-center px-8">
        <StatusBar barStyle="light-content" />
        <Text className="text-[#F5F0E8] text-lg text-center font-['MontserratAlternates-SemiBold']">
          Something went wrong
        </Text>
        <Text className="text-[#6B6357] text-sm text-center mt-2 font-['MontserratAlternates-Regular']">
          Unable to load premium details. Please try again later.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-6 px-5 py-3 rounded-xl bg-[#141414] border border-[rgba(255,255,255,0.1)]"
        >
          <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-Medium']">
            Go back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (hasActivePass) {
    return (
      <SafeAreaView className="flex-1 bg-[#0A0A0A] items-center justify-center px-8">
        <StatusBar barStyle="light-content" />
        <Sparkles color="#D4860A" size={36} />
        <Text className="text-[#F5F0E8] text-lg text-center mt-4 font-['MontserratAlternates-SemiBold']">
          You already have Premium
        </Text>
        <Text className="text-[#6B6357] text-sm text-center mt-2 font-['MontserratAlternates-Regular']">
          Enjoy full access to every premium feature.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-6 px-5 py-3 rounded-xl bg-[#141414] border border-[rgba(255,255,255,0.1)]"
        >
          <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-Medium']">
            Go back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0A0A0A]">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0A', '#14110B', '#0A0A0A']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full bg-[#141414] border border-[rgba(255,255,255,0.1)] items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>
          <Text className="text-[#F5F0E8] text-xl font-['MontserratAlternates-Bold']">
            Upgrade
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-[#141414] rounded-3xl border border-[rgba(212,134,10,0.25)] p-5 mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Sparkles color="#D4860A" size={16} />
              <Text className="text-[#D4860A] text-xs uppercase tracking-[0.8px] font-['MontserratAlternates-SemiBold']">
                Epocheye Premium
              </Text>
            </View>

            <Text className="text-[#F5F0E8] text-2xl font-['MontserratAlternates-Bold'] leading-7">
              {config.name}
            </Text>
            <Text className="text-[#B8AF9E] text-sm mt-2 font-['MontserratAlternates-Regular'] leading-5">
              {config.description}
            </Text>

            <View className="flex-row items-baseline gap-2 mt-5">
              {discountPercent > 0 && (
                <Text className="text-[#6B6357] text-base font-['MontserratAlternates-Regular'] line-through">
                  {formatInr(basePrice)}
                </Text>
              )}
              <Text className="text-[#F5F0E8] text-4xl font-['MontserratAlternates-Bold']">
                {formatInr(finalPrice)}
              </Text>
              <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Regular']">
                / {config.validity_days} days
              </Text>
            </View>
          </View>

          <View className="bg-[#141414] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 mb-4">
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
                  onChangeText={(t) => {
                    setCouponInput(t.toUpperCase());
                    if (couponResult) setCouponResult(null);
                  }}
                  placeholder="Enter code"
                  placeholderTextColor="rgba(245,240,232,0.25)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleApplyCoupon}
                  className="flex-1 bg-[#1E1E1E] border border-[rgba(255,255,255,0.1)] rounded-xl px-3 py-2.5 text-[#F5F0E8] text-sm font-['MontserratAlternates-Regular']"
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

          <TouchableOpacity
            onPress={handlePurchase}
            disabled={purchasing}
            className="py-4 rounded-2xl items-center justify-center flex-row gap-2 bg-[#D4860A]"
            accessibilityRole="button"
          >
            {purchasing ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <>
                <Sparkles color="#0A0A0A" size={18} />
                <Text className="text-[#0A0A0A] text-base font-['MontserratAlternates-Bold']">
                  Unlock Premium · {formatInr(finalPrice)}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text className="text-[#6B6357] text-xs text-center mt-3 font-['MontserratAlternates-Regular']">
            Secure checkout via Razorpay · One-time payment
          </Text>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default PurchaseScreen;
