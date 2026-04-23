export interface ExplorerPassConfigAdmin {
  default_price_paise: number;
  single_access_hours: number;
  pass_default_hours: number;
  pass_max_hours: number;
  extension_24h_paise: number;
  extension_48h_paise: number;
}

export interface QuoteLineItem {
  place_id: string;
  place_name?: string;
  price_paise: number;
  source: 'override' | 'default' | 'extension';
}

export interface ExplorerPassQuote {
  line_items: QuoteLineItem[];
  place_count: number;
  subtotal_paise: number;
  extension_paise: number;
  discount_amount_paise: number;
  total_paise: number;
  access_hours: number;
  duration_hours: number;
  is_single_place: boolean;
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
  access_hours: number;
  is_single_place: boolean;
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
  duration_hours: number;
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

export interface ScanReportPayload {
  scan_id?: string;
  reason: string;
  notes?: string;
  image_url?: string;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };
