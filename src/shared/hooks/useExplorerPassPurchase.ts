/**
 * Shared hook for the Explorer Pass purchase flow.
 *
 * 1. Call calculateExplorerPassPrice for live price preview
 * 2. Call initiateExplorerPass → creates Razorpay order
 * 3. Open Razorpay checkout
 * 4. Call confirmExplorerPass on Razorpay success → pass issued
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
// @ts-ignore — react-native-razorpay ships no types; the JS API is stable
import RazorpayCheckout from 'react-native-razorpay';
import {
  calculateExplorerPassPrice,
  initiateExplorerPass,
  confirmExplorerPass,
  type ExplorerPass,
  type PriceCalculation,
} from '../../utils/api/explorer-pass';
import { createAuthenticatedClient } from '../../utils/api/auth';
import {
  toFriendlyPaymentError,
  VERIFICATION_FAILED_ERROR,
  ORDER_CREATE_FAILED_ERROR,
} from '../utils/paymentErrors';

export interface UseExplorerPassPurchaseReturn {
  purchasing: boolean;
  calculating: boolean;
  priceInfo: PriceCalculation | null;
  calculatePrice: (placeIds: string[], couponCode?: string) => Promise<PriceCalculation | null>;
  purchase: (placeIds: string[], couponCode?: string) => Promise<ExplorerPass | null>;
}

export function useExplorerPassPurchase(): UseExplorerPassPurchaseReturn {
  const [purchasing, setPurchasing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [priceInfo, setPriceInfo] = useState<PriceCalculation | null>(null);

  const calculatePrice = useCallback(
    async (placeIds: string[], couponCode?: string): Promise<PriceCalculation | null> => {
      if (placeIds.length === 0) {
        setPriceInfo(null);
        return null;
      }
      setCalculating(true);
      try {
        const result = await calculateExplorerPassPrice(placeIds, couponCode);
        if (result.success) {
          setPriceInfo(result.data);
          return result.data;
        }
        Alert.alert('Pricing Error', result.error.message);
        return null;
      } finally {
        setCalculating(false);
      }
    },
    [],
  );

  const purchase = useCallback(
    async (placeIds: string[], couponCode?: string): Promise<ExplorerPass | null> => {
      if (placeIds.length === 0) {
        Alert.alert('No Places Selected', 'Please select at least one place to purchase.');
        return null;
      }
      setPurchasing(true);
      try {
        const normalizedCoupon = couponCode?.trim().toUpperCase() || undefined;

        // Step 1 — initiate (backend creates Razorpay order)
        const initResult = await initiateExplorerPass(placeIds, normalizedCoupon);
        if (!initResult.success) {
          Alert.alert('Error', initResult.error.message);
          return null;
        }
        const init = initResult.data;

        if (!init.razorpay_order_id || !init.amount_paise || !init.key_id) {
          Alert.alert(ORDER_CREATE_FAILED_ERROR.title, ORDER_CREATE_FAILED_ERROR.message);
          return null;
        }

        const description =
          init.place_count === 1
            ? `Explorer Pass — 1 Place`
            : `Explorer Pass — ${init.place_count} Places`;

        const options = {
          key: init.key_id,
          amount: String(init.amount_paise),
          currency: init.currency || 'INR',
          name: 'Epocheye',
          description,
          order_id: init.razorpay_order_id,
          prefill: {
            name: init.prefill?.name || '',
            email: init.prefill?.email || '',
            contact: init.prefill?.contact || '',
          },
          theme: { color: '#D4860A' },
        };

        // Step 2 — open Razorpay checkout
        const razorpayData = await RazorpayCheckout.open(options);

        // Step 3 — confirm payment with backend
        const confirmResult = await confirmExplorerPass({
          razorpay_order_id: razorpayData.razorpay_order_id,
          razorpay_payment_id: razorpayData.razorpay_payment_id,
          razorpay_signature: razorpayData.razorpay_signature,
        });

        if (!confirmResult.success) {
          Alert.alert(VERIFICATION_FAILED_ERROR.title, VERIFICATION_FAILED_ERROR.message);
          return null;
        }

        // Step 4 — fire-and-forget coupon order recording
        if (init.coupon_code) {
          recordCouponOrder({
            couponCode: init.coupon_code,
            razorpayOrderId: razorpayData.razorpay_order_id,
            razorpayPaymentId: razorpayData.razorpay_payment_id,
            originalAmount: init.original_amount_paise,
            discountedAmount: init.amount_paise,
            itemDescription: description,
          }).catch(() => {
            // Silently ignore — creator attribution is a background concern
          });
        }

        return confirmResult.data.pass;
      } catch (error: unknown) {
        const friendly = toFriendlyPaymentError(error);
        Alert.alert(friendly.title, friendly.message);
        return null;
      } finally {
        setPurchasing(false);
      }
    },
    [],
  );

  return { purchasing, calculating, priceInfo, calculatePrice, purchase };
}

/** Fire-and-forget: record coupon attribution in the backend after payment */
async function recordCouponOrder(params: {
  couponCode: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  originalAmount: number;
  discountedAmount: number;
  itemDescription?: string;
}): Promise<void> {
  const client = createAuthenticatedClient();
  await client.post('/api/v1/orders/record', {
    coupon_code: params.couponCode,
    razorpay_order_id: params.razorpayOrderId,
    razorpay_payment_id: params.razorpayPaymentId,
    original_amount: params.originalAmount,
    discounted_amount: params.discountedAmount,
    item_description: params.itemDescription,
  });
}
