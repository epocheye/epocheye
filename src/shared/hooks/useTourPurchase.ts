/**
 * Shared hook for the tour purchase flow.
 *
 * Handles:
 *  1. Call initiatePurchase — free tour → done; paid → get Razorpay order
 *  2. Open Razorpay checkout for paid tours
 *  3. Call confirmPurchase on Razorpay success
 *  4. Return updated access state to the caller
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
// @ts-ignore — react-native-razorpay types may not ship; the JS API is stable
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_KEY_ID } from '@env';
import {
  confirmPurchase,
  initiatePurchase,
} from '../../utils/api/tours';
import { useUser } from '../../context';

export interface PurchaseResult {
  accessGranted: boolean;
  expiresAt: string;
}

export interface UseTourPurchaseReturn {
  purchasing: boolean;
  handleBuyTour: (
    tourId: string,
    pricePaise: number,
    tourTitle: string,
  ) => Promise<PurchaseResult | null>;
}

export function useTourPurchase(): UseTourPurchaseReturn {
  const [purchasing, setPurchasing] = useState(false);
  const profile = useUser(state => state.profile);

  const handleBuyTour = useCallback(
    async (
      tourId: string,
      pricePaise: number,
      tourTitle: string,
    ): Promise<PurchaseResult | null> => {
      setPurchasing(true);
      try {
        // Step 1 — initiate
        const initResult = await initiatePurchase(tourId);
        if (!initResult.success) {
          Alert.alert('Error', initResult.error.message);
          return null;
        }

        const init = initResult.data;

        // Free tour — directly granted
        if (init.access_granted && init.expires_at) {
          return { accessGranted: true, expiresAt: init.expires_at };
        }

        // Paid tour — open Razorpay checkout
        if (!init.razorpay_order_id || !init.amount_paise) {
          Alert.alert('Error', 'Could not create payment order. Please try again.');
          return null;
        }

        const options = {
          key: RAZORPAY_KEY_ID || '',
          amount: String(init.amount_paise),
          currency: init.currency || 'INR',
          name: 'EpochEye',
          description: tourTitle,
          order_id: init.razorpay_order_id,
          prefill: {
            name: profile?.name || '',
            email: profile?.email || '',
          },
          theme: { color: '#D4860A' },
        };

        // Step 3 — open Razorpay checkout and wait
        const razorpayData = await RazorpayCheckout.open(options);

        // Step 4 — confirm with backend
        const confirmResult = await confirmPurchase(tourId, {
          razorpay_order_id: razorpayData.razorpay_order_id,
          razorpay_payment_id: razorpayData.razorpay_payment_id,
          razorpay_signature: razorpayData.razorpay_signature,
        });

        if (!confirmResult.success) {
          Alert.alert(
            'Payment Issue',
            'Payment received but verification failed. Please contact support.',
          );
          return null;
        }

        return {
          accessGranted: confirmResult.data.access_granted,
          expiresAt: confirmResult.data.expires_at,
        };
      } catch (error: unknown) {
        // Razorpay throws when user cancels or payment fails
        const message =
          error && typeof error === 'object' && 'description' in error
            ? String((error as { description: unknown }).description)
            : 'Payment was cancelled or failed.';
        Alert.alert('Payment Cancelled', message);
        return null;
      } finally {
        setPurchasing(false);
      }
    },
    [profile],
  );

  return { purchasing, handleBuyTour };
}
