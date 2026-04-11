export interface PremiumProductConfig {
  name: string;
  description: string;
  price_inr: number;
  validity_days: number;
  enabled: boolean;
}

export interface PremiumPass {
  id: string;
  user_uuid: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount_paise: number;
  coupon_code?: string | null;
  purchased_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface PremiumInitiateResult {
  razorpay_order_id: string;
  amount_paise: number;
  original_amount_paise: number;
  currency: string;
  key_id: string;
  product_name: string;
  product_description: string;
  coupon_code?: string;
  discount_percent?: number;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface PremiumConfirmPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };
