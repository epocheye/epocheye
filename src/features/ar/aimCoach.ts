/**
 * Aim coaching copy — one home for what the visitor is told when they hold the phone
 * in a way the AR cannot work with.
 *
 * The verdict itself is computed natively (EpocheyeDetectARView.aimTick), already
 * debounced with hysteresis, so this module is purely presentation: what to say, and
 * whether the narration should wait.
 *
 * Copy rules, learned the hard way from the tracking banners: name the ACTION, not the
 * fault. "Hold the phone up" tells someone what to do; "pitch out of range" makes them
 * feel stupid and tells them nothing.
 */

export type AimState =
  | 'OK'
  | 'OFF_TARGET'
  | 'TOO_LOW'
  | 'TOO_HIGH'
  | 'TOO_FAST'
  | 'COVERED'
  | 'FOLLOW';

export interface AimCoaching {
  /** Null when nothing should be shown. */
  message: string | null;
  /** Arrow direction when the figure is off screen. */
  arrow: 'left' | 'right' | null;
  /**
   * True while narration must hold. A visitor who looked away should not lose a line
   * of dialogue they can never get back — the story waits for them, not the reverse.
   */
  pauseNarration: boolean;
}

export function aimCoaching(state: string, angleDeg: number): AimCoaching {
  switch (state) {
    case 'OFF_TARGET':
      return {
        message: 'Tipu is this way',
        // Native sends a signed bearing: positive means he is to the right.
        arrow: angleDeg >= 0 ? 'right' : 'left',
        pauseNarration: true,
      };
    case 'TOO_LOW':
      return {
        message: 'Hold the phone up, at eye level',
        arrow: null,
        pauseNarration: true,
      };
    case 'TOO_HIGH':
      return {
        message: 'Bring the phone down a little',
        arrow: null,
        pauseNarration: true,
      };
    case 'TOO_FAST':
      // Not paused: a quick pan is normal and the moment passes on its own. Pausing
      // here would stutter the audio constantly.
      return {message: 'Move slowly', arrow: null, pauseNarration: false};
    case 'FOLLOW':
      // He is still on screen, just walking away. Not a mistake by the visitor, so the
      // tone is an invitation rather than a correction - and narration keeps playing,
      // because he may well be talking as he leads.
      return {message: 'Follow him', arrow: null, pauseNarration: false};
    case 'COVERED':
      return {
        message: 'Something is covering the camera',
        arrow: null,
        pauseNarration: true,
      };
    default:
      return {message: null, arrow: null, pauseNarration: false};
  }
}
