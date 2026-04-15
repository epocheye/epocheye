export interface ReconstructRequest {
  monument_id: string;
  object_label: string;
  image_base64?: string;
  image_url?: string;
}

export interface ReconstructResponse {
  monument_id: string;
  object_label: string;
  glb_url: string;
  thumbnail_url?: string;
  provider: string;
  cached: boolean;
  duration_ms: number;
  generated_at: string;
  quota_remaining: number;
  quota_limit: number;
  user_tier: 'free' | 'premium' | string;
}

export interface QuotaExceededResponse {
  upgrade_required: boolean;
  current_plan: 'free' | 'premium' | string;
  used: number;
  limit: number;
  reset_at: string;
  message: string;
}

export interface UserArConfig {
  enabled: boolean;
  maintenance_mode: boolean;
  provider: string;
  free_daily_quota: number;
  premium_daily_quota: number;
  user_tier: 'free' | 'premium' | string;
  today_used: number;
  today_remaining: number;
  next_reset: string;
}

export type ArResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } }
  | { success: false; quotaExceeded: true; data: QuotaExceededResponse };
