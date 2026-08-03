declare module '@env' {
  export const GOOGLE_MAPS_API_KEY: string;
  export const baseUrl: string;
  export const RAZORPAY_KEY_ID: string;
  export const SAM_LAMBDA_URL: string;
  export const ROBOFLOW_ENABLED: string;
  export const ROBOFLOW_MIN_CONFIDENCE: string;
  export const ROBOFLOW_COMMIT_CONFIDENCE: string;
  export const ROBOFLOW_MOCK_CLASS: string;
  export const GLB_BASE_URL: string;
  /** CDN base for audio-guide clips (same bucket/distribution as GLB, `audio/` prefix). Clip URLs are built as {AUDIO_BASE_URL}/{key}; absolute audio_url values bypass it. */
  export const AUDIO_BASE_URL: string;
  /** "true"/"1" to surface the admin-only Capture Anchor entry in Settings. Off by default (never shown in production builds). */
  export const ENABLE_ANCHOR_CAPTURE: string;
}
