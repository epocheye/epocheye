/**
 * ONE CALL TO ACTION PER SITE, resolved rather than listed.
 *
 * SiteDetail carried SIX buttons: View in AR, Begin the journey, Step inside,
 * See the reconstruction, Listen, Learn About It. Four of them were invisible
 * to everyone outside a three-address allowlist, so the screen a real visitor
 * saw was two buttons, and the screen an admin saw was a wall. Neither told
 * anyone where to start.
 *
 * This picks the best single entry the site actually has, and the label comes
 * from what it picked rather than from a generic string. The ladder is ordered
 * by how much of the site each rung gives you, not by what is cheapest to run:
 *
 *   1. JOURNEY   the whole thing — arrival, audio, reconstruction, scanning —
 *                so wherever one is authored it wins outright.
 *   2. AUDIO     the narration on its own, for a site with stops but no
 *                authored journey.
 *   3. MAGIC     the camera-off reconstruction. Bangalore Fort has one and no
 *                journey, so without this rung the fort's magic window would
 *                have had no entry point left once the button stack went — the
 *                palace never reaches it, because its journey wins at rung 1.
 *   4. RECON     the world-locked reconstruction, where a curator has authored
 *                viewing stations. Beats a generic scan because someone chose
 *                where to stand and what to show; needs AR, like SCAN.
 *   5. SCAN      point the camera and ask. Requires a device that can do AR;
 *                see below.
 *   6. ASK       the guide chat. The floor, not a fallback: it is the only rung
 *                that needs nothing from the site or the phone.
 *
 * "AR APPEARS ONLY WHERE THE DEVICE SUPPORTS IT" is the condition on rungs 4 and
 * 5, and it is the reason rung 6 is reachable at all. "View in AR" used to render
 * unconditionally — on a phone with no ARCore it was a button that led to an
 * apology. A phone that cannot do AR now gets offered the thing it CAN do.
 *
 * DISABLED IS NOT HIDDEN. The journey rung can resolve and still be inert,
 * because a journey is something you do at the site. It stays on screen, dimmed,
 * with the label saying why — the model the journey CTA already used. Hiding it
 * would teach a visitor standing 2 km away nothing at all, and the two other
 * models this screen used to run simultaneously (magic window: never gated;
 * audio guide: hidden when off-site) are both worse at that job.
 *
 * Pure and synchronous on purpose: every input is already computed in the
 * screen, and a resolver with no effects can be tested without a renderer.
 */
import type {SiteGateState} from '../../shared/hooks/useSiteGate';

/** Which entry the ladder settled on. Also the analytics `resolved_to` value. */
export type SiteCtaKey =
  | 'journey'
  | 'audio'
  | 'magic'
  | 'reconstruction'
  | 'scan'
  | 'ask';

export interface SiteCtaInput {
  /** canBeginJourney() — a journey is authored here AND this user may have it. */
  journeyAvailable: boolean;
  /** useSiteGate().state, for the disabled label. */
  journeyGateState: SiteGateState;
  /** useSiteGate().allowed — inside the venue, or an admin bypass. */
  journeyAllowed: boolean;
  /** shouldShowAudioCta() — stops exist AND (at this venue OR admin). */
  audioAvailable: boolean;
  /**
   * A magic-window scene exists for this slug, the native view is registered,
   * AND this user may open it.
   *
   * THE ADMIN PART OF THAT IS LOAD-BEARING AND MUST STAY. Both scenes are
   * admin-only, for reasons recorded at SiteDetailScreen's magic-window block:
   * the fort pending a decision about scale across forts, the palace because
   * its facade length is DISPUTED between three derivations (satellite 33.5 m,
   * OSM 35.1 m, photographs 29-33 m, deliberately not averaged) and its painted
   * decoration reconstructs an idiom rather than recording a room. Opening
   * either is a separate decision from opening the journey, and this rung must
   * not become the way that decision gets made by accident.
   */
  magicWindowAvailable: boolean;
  /**
   * At least one authored viewing station exists here. Combined with arCapable
   * below: an authored reconstruction on a phone that cannot hold it in place
   * is not an offer worth making.
   */
  hasReconstruction: boolean;
  /**
   * The scene's OWN call-to-action wording, when the magic rung is the one that
   * resolves — "Step inside, as it was painted" at the palace, "See it as it
   * stood, 1791" at the fort.
   *
   * Scene-owned rather than an i18n key, by the same deliberate design that put
   * it in scenes.ts: each reconstruction names the thing it actually shows, and
   * a shared string would flatten both into something true of neither. It is
   * the one label on this screen that is not translated, which is a real cost
   * and the reason it is passed rather than assumed.
   */
  magicWindowLabel?: string;
  /**
   * The device can run world-locked AR. False for 'arcore-missing',
   * 'device-unsupported' and 'platform-unsupported'; see useARCapability.
   *
   * While the capability check is still 'checking' pass TRUE: the scan rung is
   * the one this most often resolves to, and demoting it for the few hundred ms
   * before ArCoreApk answers would flash a different button at the visitor.
   */
  arCapable: boolean;
}

export interface SiteCta {
  key: SiteCtaKey;
  /** i18n key for the label when the button is live. */
  labelKey: string;
  /** A literal label that WINS over labelKey. Only the magic rung uses it. */
  label?: string;
  /** i18n key for the accessibility hint, when there is one worth saying. */
  hintKey?: string;
  /** True when the rung resolved but cannot be entered from here. */
  disabled: boolean;
  /** i18n key to show INSTEAD of labelKey while disabled. */
  disabledLabelKey?: string;
}

/**
 * Only the journey has a disabled state. The other five rungs are either
 * available or not resolved at all — there is no such thing as an audio guide
 * you can see but not press.
 */
function journeyCta(state: SiteGateState, allowed: boolean): SiteCta {
  if (allowed) {
    return {
      key: 'journey',
      labelKey: 'journey.cta',
      hintKey: 'journey.ctaHint',
      disabled: false,
    };
  }
  return {
    key: 'journey',
    labelKey: 'journey.cta',
    disabled: true,
    // 'checking' is a distinct message from 'outside': one asks for patience,
    // the other asks the visitor to travel. Reporting them the same way is how
    // a slow first fix reads as a refusal.
    disabledLabelKey:
      state === 'checking'
        ? 'journey.gate.checking'
        : state === 'unavailable'
          ? 'journey.gate.unavailableCta'
          : 'journey.gate.outsideCta',
  };
}

export function resolveSiteCta(input: SiteCtaInput): SiteCta {
  if (input.journeyAvailable) {
    return journeyCta(input.journeyGateState, input.journeyAllowed);
  }
  if (input.audioAvailable) {
    return {
      key: 'audio',
      labelKey: 'audioGuide.listenCta',
      hintKey: 'siteCta.audioHint',
      disabled: false,
    };
  }
  if (input.magicWindowAvailable) {
    return {
      key: 'magic',
      labelKey: 'siteCta.magicWindow',
      label: input.magicWindowLabel,
      hintKey: 'siteCta.magicWindowHint',
      disabled: false,
    };
  }
  if (input.hasReconstruction && input.arCapable) {
    return {
      key: 'reconstruction',
      labelKey: 'siteCta.reconstruction',
      hintKey: 'siteCta.reconstructionHint',
      disabled: false,
    };
  }
  if (input.arCapable) {
    return {
      key: 'scan',
      labelKey: 'siteDetail.viewInAr',
      hintKey: 'siteCta.scanHint',
      disabled: false,
    };
  }
  return {
    key: 'ask',
    labelKey: 'siteDetail.learnAboutIt',
    hintKey: 'siteCta.askHint',
    disabled: false,
  };
}
