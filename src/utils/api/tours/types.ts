/**
 * Tour API Types
 */

export interface UserAccess {
  has_access: boolean;
  expires_at?: string;
}

export interface Tour {
  id: string;
  monument_id: string;
  monument_name: string;
  title: string;
  description: string;
  price_paise: number;
  duration_minutes: number;
  content_type: 'text' | 'audio' | 'mixed';
  content_body?: string | null;
  is_active: boolean;
  user_access: UserAccess;
}

export interface MyTour extends Tour {
  purchased_at: string;
  expires_at: string;
  source: 'free_grant' | 'purchase';
}

export interface InitiateResult {
  /** Populated for free/already-free tours */
  access_granted?: boolean;
  expires_at?: string;
  /** Populated for paid tours */
  razorpay_order_id?: string;
  amount_paise?: number;
  currency?: string;
}

export interface ConfirmPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface ConfirmResult {
  access_granted: boolean;
  expires_at: string;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };
