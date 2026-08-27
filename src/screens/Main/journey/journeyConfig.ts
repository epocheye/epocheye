/**
 * Journey configuration — which venues have a guided journey, who may open it,
 * and the host figure each one uses.
 *
 * Everything here is per-venue CONTENT (a model id, a clip name, an audio key),
 * kept in one place so the screen and the SiteDetail CTA read the same record
 * and a second venue is one more entry, not a second screen.
 *
 * NOTE on the slug literal: src/config/monuments.ts is the single sanctioned
 * home for monument-slug literals in post-auth code. The venue key below should
 * move there (as JOURNEY_VENUE_SLUG) once that file is next touched; it lives
 * here for now so the journey ships as a self-contained feature directory.
 */
import { buildGlbUrl } from '../../../config/glbDelivery';
import { buildAudioUrl } from '../../../services/mediaCache';
import { isAdminUser } from '../../../shared/auth/isAdminUser';

/**
 * The ONE flag that opens the journey to everyone. While false the "Begin the
 * journey" CTA is shown only to the admin allowlist (isAdminUser) so the slice
 * can be walked on site without exposing it to visitors.
 */
export const JOURNEY_OPEN_TO_ALL = false;

/**
 * How long the arrival step waits after ARCore reports TRACKING before placing
 * the figure without a tap. Depth is usually available a second or two after
 * tracking starts; this is a short warm-up, not a wait for plane fitting (plane
 * finding is switched off natively once a figure is armed). Same value as the
 * proven DetectArScreen recipe.
 */
export const FIGURE_WARM_UP_MS = 2500;

export interface JourneyHost {
  /** GLB model id under GLB_BASE_URL (no extension). */
  figureModelId: string;
  /**
   * scaleToUnits size in metres. The rigged figure carries a 100x unit mismatch
   * in its skeleton, so it MUST stay normalised (no modelTrueScale) — 1.7 m is a
   * standing adult.
   */
  figureScaleM: number;
  /** Clip to play while he speaks the welcome. Selected by NAME, never index. */
  talkClip: string;
  /** Clip to settle into once the welcome has been heard. */
  idleClip: string;
  /**
   * Welcome narration, as a CDN key relative to AUDIO_BASE_URL (or an absolute
   * URL). First-person, generated — the script itself says so in its first
   * sentence, and the prepare step's disclaimer says it once on screen.
   */
  welcomeAudioKey: string;
}

const JOURNEY_HOSTS: Readonly<Record<string, JourneyHost>> = {
  'tipu-summer-palace-bengaluru': {
    figureModelId: 'tipu_figure_royal9',
    figureScaleM: 1.7,
    talkClip: 'Talk_with_Right_Hand_Open',
    idleClip: 'Idle_02',
    welcomeAudioKey:
      'audio/tipu-summer-palace-bengaluru/palace_overview_en_tipu.mp3',
  },
};

/** The host record for a venue, or null when no journey is authored there. */
export function journeyHostFor(
  slug: string | null | undefined,
): JourneyHost | null {
  if (!slug) return null;
  return JOURNEY_HOSTS[slug] ?? null;
}

/** Remote GLB URL for the host figure; null when no CDN base is configured. */
export function journeyFigureUrl(host: JourneyHost): string | null {
  return buildGlbUrl(host.figureModelId);
}

/** Playable URL for the welcome narration; null when no CDN base is configured. */
export function journeyWelcomeUrl(host: JourneyHost): string | null {
  return buildAudioUrl(host.welcomeAudioKey);
}

/**
 * Whether the "Begin the journey" entry point should show for this site and
 * this account. Pass the reactively-subscribed profile email so the CTA appears
 * once the profile finishes loading after login (see isAdminUser).
 */
export function canBeginJourney(
  slug: string | null | undefined,
  email?: string | null,
): boolean {
  if (!journeyHostFor(slug)) return false;
  return JOURNEY_OPEN_TO_ALL || isAdminUser(email);
}
