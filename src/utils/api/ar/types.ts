export interface ReconstructRequest {
  monument_id: string;
  object_label: string;
  image_base64?: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
}

export interface ReconstructPendingResponse {
  job_id: string;
  status: 'pending' | 'processing' | string;
  phase: 'cold_start' | 'warming_up' | 'processing' | string;
  eta_seconds: number;
  monument_id: string;
  object_label: string;
  message: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | string;
  phase?: string;
  eta_seconds?: number;
  glb_url?: string;
  thumbnail_url?: string;
  provider?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export type ReconstructOutcome =
  | { kind: 'ready'; data: ReconstructResponse }
  | { kind: 'pending'; data: ReconstructPendingResponse };

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
  scan_count: number;
  reconstruction_quality: 'none' | 'single_view' | 'multi_view' | string;
  is_improving: boolean;
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

export interface ScanContributeRequest {
  monument_id: string;
  object_label: string;
  image_base64: string;
}

export interface ScanContributeResponse {
  scan_stored: boolean;
  scan_count: number;
  rebuild_triggered: boolean;
  message: string;
}

export type ArResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } }
  | { success: false; quotaExceeded: true; data: QuotaExceededResponse };
