export interface PricingTier {
  id: number;
  min_places: number;
  max_places: number | null;
  price_per_place_paise: number;
  label: string;
  access_hours_single: number;
  access_hours_multi: number;
  sort_order: number;
  is_active: boolean;
}

export interface ExplorerPassConfig {
  tiers: PricingTier[];
  enabled: boolean;
}

export interface PriceCalculation {
  place_count: number;
  tier_id: number;
  tier_label: string;
  price_per_place_paise: number;
  subtotal_paise: number;
  discount_amount_paise: number;
  total_paise: number;
  access_hours: number;
  coupon_applied?: string;
  discount_percent?: number;
}

export interface ExplorerPassInitiateResult {
  razorpay_order_id: string;
  amount_paise: number;
  original_amount_paise: number;
  currency: string;
  key_id: string;
  place_count: number;
  tier_label: string;
  access_hours: number;
  coupon_code?: string;
  discount_percent?: number;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface ExplorerPassConfirmPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface ExplorerPass {
  id: string;
  user_uuid: string;
  place_ids: string[];
  place_count: number;
  total_amount_paise: number;
  coupon_code?: string | null;
  purchased_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface CheckAccessResult {
  has_access: boolean;
  expires_at?: string;
  pass_id?: string;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };
