/**
 * trackingHint — turn an ARCore `TrackingFailureReason` into words a visitor can act on.
 *
 * WHY THIS FILE EXISTS. Until now the native view sent the raw enum down the same
 * `onARError` channel that carries hand-written sentences, and every screen renders
 * whatever arrives there straight into a status pill. So a visitor standing in a dark
 * room at the palace was shown the literal text `INSUFFICIENT_LIGHT`, and the comment
 * on the recovery branch in `EpocheyeDetectARView.kt` records a stale `BAD_STATE` left
 * sitting on screen at Bangalore Fort while tracking was perfectly healthy.
 *
 * A correct mapping already existed — `trackingHint()` inside `DetectArScreen.tsx` —
 * but it was private to that file AND only rendered behind `devDirectGlb`, the admin
 * dev-harness flag. Production never reached it. This lifts it out, makes it i18n'd,
 * and puts it on a dedicated channel so it can never be confused with an app fault.
 *
 * TONE. Every string is about the ENVIRONMENT, because every one of these is something
 * the person holding the phone can change and nothing the app can. None of them says
 * "error", none of them blames the visitor, and none of them shows a symbol. That is
 * the house rule from CLAUDE.md — "calm and human, never technical jargon" — and the
 * one already written down in `ARCapabilityNotice.tsx`: inform, never block; never say
 * something false to be brief.
 */

/**
 * The five values ARCore can report, plus the empty string it sends on recovery.
 *
 * Typed as a union rather than `string` so that adding a case to the switch is a
 * compile error if a new reason ever appears, instead of silently falling through to
 * the generic line.
 */
export type TrackingFailureReason =
  | 'INSUFFICIENT_LIGHT'
  | 'INSUFFICIENT_FEATURES'
  | 'EXCESSIVE_MOTION'
  | 'CAMERA_UNAVAILABLE'
  | 'BAD_STATE'
  | 'NONE';

/** Every reason that has its own copy. Used by the test to prove none is missed. */
export const TRACKING_FAILURE_REASONS: readonly TrackingFailureReason[] = [
  'INSUFFICIENT_LIGHT',
  'INSUFFICIENT_FEATURES',
  'EXCESSIVE_MOTION',
  'CAMERA_UNAVAILABLE',
  'BAD_STATE',
] as const;

/** Normalise whatever the bridge sent. `''`/null/unknown all mean "nothing wrong". */
export function parseTrackingFailure(raw: string | null | undefined): TrackingFailureReason {
  if (!raw) return 'NONE';
  const up = raw.toUpperCase();
  return (TRACKING_FAILURE_REASONS as readonly string[]).includes(up)
    ? (up as TrackingFailureReason)
    : 'NONE';
}

/**
 * Whether trying again can plausibly help.
 *
 * `CAMERA_UNAVAILABLE` means another app holds the camera; retrying without closing
 * that app just fails again, so the copy asks for the real fix instead of promising a
 * retry will work. Everything else clears on its own once the visitor moves, adds
 * light, or slows down — so a retry is honest there.
 */
export function isTrackingFailureRetryable(reason: TrackingFailureReason): boolean {
  return reason !== 'NONE' && reason !== 'CAMERA_UNAVAILABLE';
}

/**
 * i18n key for a reason. Kept as keys rather than literals so Hindi and Bengali can
 * be filled in later without touching this logic.
 *
 * `torch` matters for darkness only: the app is not helpless there — after 2 s of
 * `INSUFFICIENT_LIGHT` with no floor found it lights the phone's own lamp
 * (`Config.FlashMode.TORCH`, see `governTorch`). Saying so is the difference between
 * "it's too dark" and "it's too dark, I've turned the lamp on, and here is what the
 * lamp cannot reach".
 */
export function trackingHintKey(
  reason: TrackingFailureReason,
  torch = false,
): string | null {
  switch (reason) {
    case 'INSUFFICIENT_LIGHT':
      return torch ? 'arSession.darkTorchOn' : 'arSession.dark';
    case 'INSUFFICIENT_FEATURES':
      return 'arSession.plain';
    case 'EXCESSIVE_MOTION':
      return 'arSession.tooFast';
    case 'CAMERA_UNAVAILABLE':
      return 'arSession.cameraBusy';
    case 'BAD_STATE':
      return 'arSession.lost';
    case 'NONE':
      return null;
  }
}
