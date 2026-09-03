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
 * The ONE flag that opens the journey to everyone. While false the journey is
 * shown only to the admin allowlist (isAdminUser) so the slice can be walked on
 * site without exposing it to visitors.
 *
 * NOW TRUE. The journey is the single call to action on SiteDetail
 * (screens/Main/siteCta.ts), so leaving this false would have meant one button
 * that three accounts could press and everyone else resolved past.
 *
 * IT IS STILL GEOFENCED. useJourneyGate answers 'outside' beyond the venue
 * radius and the CTA renders dimmed with "Available at the palace"; admins get
 * 'bypass'. Opening the flag opens WHO may enter, not FROM WHERE.
 *
 * WHAT THIS FLIP DELIBERATELY DOES NOT OPEN: the magic window. The journey's
 * guide step can hand off to it, and that hand-off used to rely on this flag
 * being false for its access control — a load-bearing assumption written down
 * in a comment and nowhere else. PalaceJourneyScreen now applies isAdminUser
 * directly, so both magic-window scenes stay admin-only on their own terms
 * (the palace pending a tape measurement of its disputed facade), independent
 * of this flag.
 */
export const JOURNEY_OPEN_TO_ALL = true;

/**
 * How long the arrival step waits after ARCore reports TRACKING before placing
 * the figure without a tap. Depth is usually available a second or two after
 * tracking starts; this is a short warm-up, not a wait for plane fitting (plane
 * finding is switched off natively once a figure is armed). Same value as the
 * proven DetectArScreen recipe.
 */
export const FIGURE_WARM_UP_MS = 2500;

export interface JourneyHost {
  /**
   * The venue's display name, for surfaces the journey opens that need one —
   * the guide chat's header, today. The journey screen is reached by slug and
   * never fetches the site record, so without this the chat would be titled
   * with a URL slug.
   */
  siteName: string;
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
   *
   * IT IS THE FIGURE'S VOICE, NOT THE GUIDE'S, and that distinction is
   * load-bearing. LawnStep plays this over the lip-synced figure, so the person
   * speaking is Tipu, not the narrator. record_figure_voice.py states the rule:
   * en-IN-Chirp3-HD-Achird for figures, "deliberately a DIFFERENT voice from
   * the guide's Aoede — he is a character being quoted, not the narrator."
   * Purnaiah's five lines at P5 already follow it.
   *
   * WHAT WAS WRONG UNTIL NOW is that this one clip followed neither rule. It
   * was cut by scripts/tipu_voice.py on en-IN-Neural2-B at speakingRate 0.90
   * and pitch −2.0 — a different engine generation, a third voice, and the only
   * clip left in the project carrying a pitch offset. A journey visitor heard
   * Neural2-B welcome them, Aoede narrate eight stops, and Achird speak as
   * Purnaiah: three voices for two roles. Re-cut on Achird at rate 1.0 with no
   * pitch, that collapses to two.
   */
  welcomeAudioKey: string;
}

const JOURNEY_HOSTS: Readonly<Record<string, JourneyHost>> = {
  'tipu-summer-palace-bengaluru': {
    figureModelId: 'tipu_figure_royal9',
    figureScaleM: 1.7,
    siteName: "Tipu Sultan's Summer Palace",
    talkClip: 'Talk_with_Right_Hand_Open',
    idleClip: 'Idle_02',
    // _v2: the Achird re-cut. 31.728 s, ffprobed on the object CloudFront
    // actually serves (126 912 bytes, matched against Content-Length), not on a
    // sibling render. The _v1 object is NOT deleted — it went up `immutable,
    // max-age=31536000`, so it cannot be overwritten in place, and it is what a
    // revert of this line points back at.
    welcomeAudioKey:
      'audio/tipu-summer-palace-bengaluru/palace_overview_en_tipu_v2.mp3',
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
