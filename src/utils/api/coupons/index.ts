import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';

export interface CouponValidation {
  is_valid: boolean;
  reason?: 'not_found' | 'expired' | 'exhausted';
  coupon_id?: string;
  code?: string;
  discount_percent?: number;
}

export interface DiscountCalculation {
  original_amount: number;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  coupon_code: string;
  coupon_id: string;
}

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };

export async function validateCoupon(code: string): Promise<ApiResult<CouponValidation>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<CouponValidation>(
      `/api/v1/coupons/validate?code=${encodeURIComponent(code.toUpperCase().trim())}`,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function calculateDiscount(
  code: string,
  amountPaise: number,
): Promise<ApiResult<DiscountCalculation>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<DiscountCalculation>(
      `/api/v1/coupons/calculate?code=${encodeURIComponent(code.toUpperCase().trim())}&amount=${amountPaise}`,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
