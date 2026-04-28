export interface ReconstructRequest {
  monument_id: string;
  object_label: string;
  image_base64?: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  /** Optional Gemini bbox [y0, x0, y1, x1] in 0-1000 scale. Server crops before SAM 3D. */
  crop_bbox_2d?: [number, number, number, number];
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

export type AnchorMode = 'geospatial' | 'compass';

export interface ArAnchor {
  id: string;
  monument_id: string;
  object_label: string;
  anchor_mode: AnchorMode;
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
  heading_deg?: number | null;
  ref_lat?: number | null;
  ref_lng?: number | null;
  ref_landmark_url?: string;
  bearing_from_ref?: number | null;
  distance_meters?: number | null;
  created_at: string;
  updated_at: string;
}

export interface AnchorsResponse {
  anchors: ArAnchor[];
}

/**
 * One renderable object in the curated AR site catalog. Joined view of
 * monument_anchors + monument_objects + ar_reconstruction_cache.
 */
export interface SiteBundleObject {
  object_label: string;
  glb_url: string;
  thumbnail_url?: string;
  hit_count: number;
  anchor_mode: AnchorMode;
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
  heading_deg?: number | null;
  ref_lat?: number | null;
  ref_lng?: number | null;
  bearing_from_ref?: number | null;
  distance_meters?: number | null;
}

export interface SiteBundleResponse {
  monument_id: string;
  /** Asset-grouped view; preferred. Each asset carries its placements array. */
  assets?: SiteBundleAsset[];
  /** Legacy flat array, one entry per placement. Kept for older clients. */
  objects: SiteBundleObject[];
}

/**
 * Body for POST /api/v1/ar/recognize. Catalog-mode recognition: visitor sends
 * GPS + image, server returns the matching curated GLB or "unknown".
 *
 * `hit_test_pose`, when present, is a world pose computed by ARCore raycast
 * (mobile screen tap → plane intersection). The backend persists a new
 * gemini_runtime placement at this pose so future visitors at the same spot
 * get O(1) curated lookups.
 *
 * `ar_supported=false` short-circuits to viewer_only — server skips placement
 * resolution entirely.
 */
export interface RecognizeRequest {
  monument_id: string;
  lat: number;
  lng: number;
  image_base64: string;
  hit_test_pose?: HitTestPose;
  ar_supported?: boolean;
}

/** World pose from ARCore HitTest. Lat/lng/alt + heading. */
export interface HitTestPose {
  lat: number;
  lng: number;
  altitude: number;
  heading_deg: number;
}

/** The canonical GLB the user matched, regardless of where it's placed. */
export interface RecognizeAsset {
  asset_id: string;
  object_label: string;
  glb_url: string;
  thumbnail_url?: string;
  knowledge_text?: string;
}

/** Where to render the asset in real space. */
export interface RecognizePlacement {
  id: string;
  anchor_mode: AnchorMode;
  source: 'admin' | 'gemini_runtime' | 'imported' | string;
  confidence: number;
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
  heading_deg?: number | null;
  ref_lat?: number | null;
  ref_lng?: number | null;
  bearing_from_ref?: number | null;
  distance_meters?: number | null;
}

/**
 * place_strategy tells mobile how to render:
 * - 'curated' / 'runtime_persisted' → use placement directly in AR
 * - 'pose_fallback'                 → mobile creates a Geospatial anchor
 *                                     at its own current pose
 * - 'viewer_only'                   → ARCore unavailable, open ThreeJsViewerScreen
 */
export type PlaceStrategy =
  | 'curated'
  | 'runtime_persisted'
  | 'pose_fallback'
  | 'viewer_only';

export interface RecognizeResponse {
  match: 'catalog' | 'unknown';
  place_strategy?: PlaceStrategy;
  asset?: RecognizeAsset;
  placement?: RecognizePlacement;
  confidence: number;
  tier: 'proximity' | 'phash' | 'gemini' | 'unknown';
  knowledge_text?: string;
}

/** RecognizeAnchor preserved as alias for backwards-compat with prior consumers. */
export type RecognizeAnchor = RecognizePlacement;

/**
 * Body for POST /api/v1/ar/unknown-scan — visitor's "Help us add this"
 * submission. Server uploads the photo to Cloudinary and inserts an
 * ar_unknown_scans row (or bumps upvotes on a near-duplicate).
 */
export interface SubmitUnknownScanRequest {
  monument_id: string;
  image_base64: string;
  suggested_label?: string;
  lat: number;
  lng: number;
}

export interface SubmitUnknownScanResponse {
  id: string;
  merged: boolean;
  upvotes: number;
  status: 'pending' | 'queued' | 'generated' | 'rejected' | string;
  created_at: string;
}

/** Site bundle reshaped — assets each carry their placements array. */
export interface SiteBundlePlacement {
  id: string;
  anchor_mode: AnchorMode;
  source: 'admin' | 'gemini_runtime' | 'imported' | string;
  confidence: number;
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
  heading_deg?: number | null;
  ref_lat?: number | null;
  ref_lng?: number | null;
  bearing_from_ref?: number | null;
  distance_meters?: number | null;
}

export interface SiteBundleAsset {
  asset_id: string;
  object_label: string;
  glb_url: string;
  thumbnail_url?: string;
  knowledge_text?: string;
  placements: SiteBundlePlacement[];
}

/** Body for POST /api/v1/ar/anchor-capture (admin-only, user-auth + is_admin). */
export interface AnchorCaptureRequest {
  monument_id: string;
  object_label: string;
  anchor_mode: AnchorMode;
  lat?: number;
  lng?: number;
  altitude?: number;
  heading_deg?: number;
  ref_lat?: number;
  ref_lng?: number;
  bearing_from_ref?: number;
  distance_meters?: number;
}
