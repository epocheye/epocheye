/**
 * PLACE, NOT ROLE — and the disclosure that travels with a generated clip.
 *
 * Two claims are pinned here.
 *
 * ONE: every place-gated feature now reads the SAME predicate, and that
 * predicate is `atVenue || isAdminUser`. Four gates were `isAdminUser(email)`
 * and are now `siteGate.allowed`:
 *
 *   PalaceJourneyScreen  magicWindowAllowed = hasMagicWindow(slug) && allowed
 *   PalaceJourneyScreen  onOpenReconstruction — passed only when that is true
 *   SiteDetailScreen     showMagicWindow = hasMagicWindow && native && allowed
 *   PointLearnScreen     allowed = useSiteGate(slug).allowed
 *
 * `allowed` is not renderable in this project (no @testing-library, so no
 * renderHook), so what is tested is the pure law it obeys — `allowed` is true
 * for exactly 'inside' and 'bypass' — together with the latch that decides
 * 'inside' and the allowlist that decides 'bypass'. The four gate expressions
 * are restated the way siteDetailSecondaryAudio.test.ts restates its one line:
 * if they are ever extracted into a helper, import it and delete the copies.
 *
 * TWO: a generated asset never reaches a visitor without its disclosure. That
 * rule is `disclosureFor`, extracted from useSubjectMedia precisely so it can
 * be asserted rather than inferred.
 *
 * Every account-shaped test below uses an email deliberately OFF the admin
 * allowlist, because "it works for an admin" was the old bug, not the fix.
 */
import {
  evaluateExitLatch,
  EXIT_GRACE_MS,
  EXIT_MARGIN_M,
  type SiteGateState,
} from '../../src/shared/hooks/useSiteGate';
import { disclosureFor } from '../../src/shared/hooks/useSubjectMedia';
import { isAdminUser, ADMIN_EMAILS } from '../../src/shared/auth/isAdminUser';
import { hasMagicWindow } from '../../src/features/magicwindow/scenes';

const PALACE = 'tipu-summer-palace-bengaluru';
const FORT = 'bangalore-fort';
const VISITOR = 'someone@example.com'; // NOT on the admin allowlist
const ADMIN = ADMIN_EMAILS[0];

/** useSiteGate's own return rule: `allowed` is 'inside' or 'bypass'. */
const allowedFor = (state: SiteGateState): boolean =>
  state === 'inside' || state === 'bypass';

/** PalaceJourneyScreen — `magicWindowAllowed` */
const magicWindowAllowed = (slug: string, allowed: boolean) =>
  hasMagicWindow(slug) && allowed;

/** AudioGuideStep gets `onOpenReconstruction` only when the parent may pass it. */
const reconstructionOffered = (slug: string, allowed: boolean) =>
  magicWindowAllowed(slug, allowed);

/** SiteDetailScreen — `showMagicWindow`, with the native view registered. */
const showMagicWindow = (slug: string, nativeReady: boolean, allowed: boolean) =>
  hasMagicWindow(slug) && nativeReady && allowed;

describe('the gate is `atVenue || isAdminUser`, in one place', () => {
  it('is true for inside and bypass, and false for every other state', () => {
    expect(allowedFor('inside')).toBe(true);
    expect(allowedFor('bypass')).toBe(true);
    expect(allowedFor('outside')).toBe(false);
    expect(allowedFor('unavailable')).toBe(false);
    // 'checking' must be false: a slow first fix is not a refusal, but it is
    // not permission either, and treating it as permission would flash the
    // content open and then take it away.
    expect(allowedFor('checking')).toBe(false);
  });

  it('reaches "bypass" only for the allowlist — a visitor is not an admin', () => {
    expect(isAdminUser(VISITOR)).toBe(false);
    expect(isAdminUser(ADMIN)).toBe(true);
  });
});

describe('inside the fence, a NON-admin reaches everything', () => {
  const allowed = allowedFor('inside');

  it('opens the magic window in the journey, and with it all five figures', () => {
    expect(isAdminUser(VISITOR)).toBe(false);
    expect(magicWindowAllowed(PALACE, allowed)).toBe(true);
  });

  it('offers "See this room as it was" on the stops', () => {
    expect(reconstructionOffered(PALACE, allowed)).toBe(true);
  });

  it("opens the fort's own rung, which is the fort's only door", () => {
    expect(showMagicWindow(FORT, true, allowed)).toBe(true);
  });
});

describe('outside the fence, a NON-admin reaches none of it', () => {
  for (const state of ['outside', 'unavailable', 'checking'] as const) {
    it(`refuses every gate while '${state}'`, () => {
      const allowed = allowedFor(state);
      expect(magicWindowAllowed(PALACE, allowed)).toBe(false);
      expect(reconstructionOffered(PALACE, allowed)).toBe(false);
      expect(showMagicWindow(FORT, true, allowed)).toBe(false);
    });
  }
});

describe('an admin reaches everything from either position', () => {
  it('passes on bypass, which is what an off-site admin resolves to', () => {
    const allowed = allowedFor('bypass');
    expect(magicWindowAllowed(PALACE, allowed)).toBe(true);
    expect(showMagicWindow(FORT, true, allowed)).toBe(true);
  });

  it('passes on inside too — standing at the site is not a downgrade', () => {
    const allowed = allowedFor('inside');
    expect(magicWindowAllowed(PALACE, allowed)).toBe(true);
  });
});

describe('hasMagicWindow stays a CONTENT check, not a permission', () => {
  it('refuses a venue with nothing built, however present the visitor is', () => {
    const allowed = allowedFor('inside');
    expect(magicWindowAllowed('konark-sun-temple', allowed)).toBe(false);
    expect(showMagicWindow('konark-sun-temple', true, allowed)).toBe(false);
  });

  it('refuses when the native view is not registered, at either venue', () => {
    expect(showMagicWindow(FORT, false, allowedFor('inside'))).toBe(false);
    expect(showMagicWindow(PALACE, false, allowedFor('bypass'))).toBe(false);
  });
});

describe('losing the fix does not eject a visitor mid-experience', () => {
  const inside = {
    rawInside: false,
    sticky: true,
    outsideSinceMs: null,
    nowMs: 1_000_000,
  };

  it('holds when the distance cannot be computed at all', () => {
    // A fix that stops arriving is "we cannot tell", not "they left".
    const r = evaluateExitLatch({ ...inside, distanceM: null, radiusM: 1000 });
    expect(r.inside).toBe(true);
    expect(r.outsideSinceMs).toBeNull();
  });

  it('holds inside the exit margin', () => {
    const r = evaluateExitLatch({
      ...inside,
      distanceM: 1000 + EXIT_MARGIN_M,
      radiusM: 1000,
    });
    expect(r.inside).toBe(true);
  });

  it('starts the clock beyond the margin but still holds until it elapses', () => {
    const first = evaluateExitLatch({
      ...inside,
      distanceM: 1000 + EXIT_MARGIN_M + 1,
      radiusM: 1000,
    });
    expect(first.inside).toBe(true);
    expect(first.outsideSinceMs).toBe(inside.nowMs);

    const still = evaluateExitLatch({
      ...inside,
      distanceM: 1000 + EXIT_MARGIN_M + 1,
      radiusM: 1000,
      outsideSinceMs: first.outsideSinceMs,
      nowMs: inside.nowMs + EXIT_GRACE_MS - 1,
    });
    expect(still.inside).toBe(true);
  });

  it('only then releases — a real departure, not a wobble', () => {
    const gone = evaluateExitLatch({
      ...inside,
      distanceM: 1000 + EXIT_MARGIN_M + 1,
      radiusM: 1000,
      outsideSinceMs: inside.nowMs,
      nowMs: inside.nowMs + EXIT_GRACE_MS,
    });
    expect(gone.inside).toBe(false);
    expect(gone.sticky).toBe(false);
  });

  it('lets someone arriving in immediately — only leaving is damped', () => {
    const r = evaluateExitLatch({
      rawInside: true,
      distanceM: 10,
      radiusM: 1000,
      sticky: false,
      outsideSinceMs: null,
      nowMs: 1_000_000,
    });
    expect(r.inside).toBe(true);
    expect(r.sticky).toBe(true);
  });
});

describe('a generated asset never plays without its disclosure', () => {
  it('drops a generated row with no disclosure', () => {
    expect(disclosureFor({ is_generated: true })).toBeNull();
    expect(disclosureFor({ is_generated: true, disclosure: '' })).toBeNull();
    expect(disclosureFor({ is_generated: true, disclosure: '   ' })).toBeNull();
  });

  it('keeps a generated row and carries its disclosure through', () => {
    expect(
      disclosureFor({
        is_generated: true,
        disclosure: 'Generated depiction, not a photograph.',
      }),
    ).toBe('Generated depiction, not a photograph.');
  });

  it('keeps a photographed row, which needs no warning', () => {
    expect(disclosureFor({ is_generated: false })).toBe('');
    expect(disclosureFor({ is_generated: false, disclosure: '' })).toBe('');
  });

  it('drops the bad row ON ITS OWN, not its siblings', () => {
    const rows = [
      { is_generated: true, disclosure: 'AI-generated.' },
      { is_generated: true, disclosure: '' },
      { is_generated: false },
    ];
    const kept = rows.filter(r => disclosureFor(r) !== null);
    expect(kept).toHaveLength(2);
  });
});
