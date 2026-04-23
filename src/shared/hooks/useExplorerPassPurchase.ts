/**
 * Shared hook for the Explorer Pass purchase flow.
 *
 * 1. Call initiateExplorerPass → creates Razorpay order (server-authoritative pricing)
 * 2. Open Razorpay checkout
 * 3. Call confirmExplorerPass on Razorpay success → pass issued
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
// @ts-ignore — react-native-razorpay ships no types; the JS API is stable
import RazorpayCheckout from 'react-native-razorpay';
import {
  initiateExplorerPass,
  confirmExplorerPass,
  type ExplorerPass,
} from '../../utils/api/explorer-pass';
import { createAuthenticatedClient } from '../../utils/api/auth';
import {
  toFriendlyPaymentError,
  VERIFICATION_FAILED_ERROR,
  ORDER_CREATE_FAILED_ERROR,
} from '../utils/paymentErrors';

export interface PurchaseOptions {
  durationHours?: number;
  couponCode?: string;
}

export interface UseExplorerPassPurchaseReturn {
  purchasing: boolean;
  purchase: (placeIds: string[], options?: PurchaseOptions) => Promise<ExplorerPass | null>;
}

export function useExplorerPassPurchase(): UseExplorerPassPurchaseReturn {
  const [purchasing, setPurchasing] = useState(false);

  const purchase = useCallback(
    async (
      placeIds: string[],
      options?: PurchaseOptions,
    ): Promise<ExplorerPass | null> => {
      if (placeIds.length === 0) {
        Alert.alert('No Places Selected', 'Please select at least one place to purchase.');
        return null;
      }
      setPurchasing(true);
      try {
        const normalizedCoupon = options?.couponCode?.trim().toUpperCase() || undefined;

        const initResult = await initiateExplorerPass(placeIds, {
          durationHours: options?.durationHours,
          couponCode: normalizedCoupon,
        });
        if (!initResult.success) {
          Alert.alert('Error', initResult.error.message);
          return null;
        }
        const init = initResult.data;

        if (!init.razorpay_order_id || !init.amount_paise || !init.key_id) {
          Alert.alert(ORDER_CREATE_FAILED_ERROR.title, ORDER_CREATE_FAILED_ERROR.message);
          return null;
        }

        const description = init.is_single_place
          ? 'EpochEye — Single Place Access'
          : `EpochEye Explorer Pass — ${init.place_count} places`;

        const razorOptions = {
          key: init.key_id,
          amount: String(init.amount_paise),
          currency: init.currency || 'INR',
          name: 'EpochEye',
          description,
          order_id: init.razorpay_order_id,
          prefill: {
            name: init.prefill?.name || '',
            email: init.prefill?.email || '',
            contact: init.prefill?.contact || '',
          },
          theme: { color: '#D4860A' },
        };

        const razorpayData = await RazorpayCheckout.open(razorOptions);

        const confirmResult = await confirmExplorerPass({
          razorpay_order_id: razorpayData.razorpay_order_id,
          razorpay_payment_id: razorpayData.razorpay_payment_id,
          razorpay_signature: razorpayData.razorpay_signature,
        });

        if (!confirmResult.success) {
          Alert.alert(VERIFICATION_FAILED_ERROR.title, VERIFICATION_FAILED_ERROR.message);
          return null;
        }

        if (init.coupon_code) {
          recordCouponOrder({
            couponCode: init.coupon_code,
            razorpayOrderId: razorpayData.razorpay_order_id,
            razorpayPaymentId: razorpayData.razorpay_payment_id,
            originalAmount: init.original_amount_paise,
            discountedAmount: init.amount_paise,
            itemDescription: description,
          }).catch(() => {
            // silent — creator attribution is best-effort
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

  return { purchasing, purchase };
}

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
