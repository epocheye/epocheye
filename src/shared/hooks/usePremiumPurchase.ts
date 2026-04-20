/**
 * Shared hook for the Epocheye Premium purchase flow.
 *
 * 1. Call initiatePremiumPurchase (with optional coupon) → Razorpay order
 * 2. Open Razorpay checkout
 * 3. Call confirmPremiumPurchase on Razorpay success → pass issued
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
// @ts-ignore — react-native-razorpay ships no types; the JS API is stable
import RazorpayCheckout from 'react-native-razorpay';
import {
  confirmPremiumPurchase,
  initiatePremiumPurchase,
  type PremiumPass,
} from '../../utils/api/premium';
import {
  toFriendlyPaymentError,
  VERIFICATION_FAILED_ERROR,
  ORDER_CREATE_FAILED_ERROR,
} from '../utils/paymentErrors';

export interface UsePremiumPurchaseReturn {
  purchasing: boolean;
  purchase: (couponCode?: string) => Promise<PremiumPass | null>;
}

export function usePremiumPurchase(): UsePremiumPurchaseReturn {
  const [purchasing, setPurchasing] = useState(false);

  const purchase = useCallback(
    async (couponCode?: string): Promise<PremiumPass | null> => {
      setPurchasing(true);
      try {
        const normalizedCoupon = couponCode?.trim().toUpperCase() || undefined;

        const initResult = await initiatePremiumPurchase(normalizedCoupon);
        if (!initResult.success) {
          Alert.alert('Error', initResult.error.message);
          return null;
        }
        const init = initResult.data;

        if (!init.razorpay_order_id || !init.amount_paise || !init.key_id) {
          Alert.alert(ORDER_CREATE_FAILED_ERROR.title, ORDER_CREATE_FAILED_ERROR.message);
          return null;
        }

        const options = {
          key: init.key_id,
          amount: String(init.amount_paise),
          currency: init.currency || 'INR',
          name: 'Epocheye',
          description: init.product_name,
          order_id: init.razorpay_order_id,
          prefill: {
            name: init.prefill?.name || '',
            email: init.prefill?.email || '',
            contact: init.prefill?.contact || '',
          },
          theme: { color: '#D4860A' },
        };

        const razorpayData = await RazorpayCheckout.open(options);

        const confirmResult = await confirmPremiumPurchase({
          razorpay_order_id: razorpayData.razorpay_order_id,
          razorpay_payment_id: razorpayData.razorpay_payment_id,
          razorpay_signature: razorpayData.razorpay_signature,
        });

        if (!confirmResult.success) {
          Alert.alert(VERIFICATION_FAILED_ERROR.title, VERIFICATION_FAILED_ERROR.message);
          return null;
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

  return { purchasing, purchase };
}
