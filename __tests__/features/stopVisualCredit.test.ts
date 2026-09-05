/**
 * A PHOTOGRAPH NEVER REACHES A VISITOR WITHOUT ITS CREDIT.
 *
 * The twin of the disclosure rule in siteGatePlaceNotRole.test.ts, and pinned
 * here for the same reason: this promise has already been broken once in this
 * app. Six CC BY 2.0 photographs ship bundled at src/assets/images/palace-rooms/
 * and are credited nowhere, behind a comment (roomPhotos.ts:16) asserting that
 * the magic window's credits block covers them — a block that names one
 * different file, used for a GLB texture. An honour system did that. So the rule
 * now lives in three places and this is the one that fails a build.
 *
 * `creditFor` is the serve-side half of ck_object_media_credit (migration 097).
 * The store-side half cannot be unit-tested from here; what CAN be tested, and
 * matters more, is the case the CHECK cannot reach at all: a backend older than
 * 097 does not know the column exists and cannot send it, so the same
 * well-formed row arrives credit-less from a stale deploy. Dropping it there is
 * what makes a lagging server show NO photographs instead of uncredited ones.
 */
import {
  creditFor,
  disclosureFor,
} from '../../src/shared/hooks/useSubjectMedia';

/** The two rules a still must clear, as useSubjectMedia composes them. */
const shows = (row: {
  is_generated: boolean;
  disclosure?: string;
  credit?: string;
}): boolean => disclosureFor(row) !== null && creditFor(row) !== null;

describe('creditFor — a photograph owes a credit', () => {
  it('keeps a photograph and carries its credit through', () => {
    expect(
      creditFor({
        is_generated: false,
        credit: 'Photograph by Pinakpani, CC BY-SA 4.0',
      }),
    ).toBe('Photograph by Pinakpani, CC BY-SA 4.0');
  });

  it('DROPS a photograph with no credit at all — the stale-backend case', () => {
    // A server older than migration 097 cannot send the field. This is the
    // only reason the check exists on the client as well as in the database.
    expect(creditFor({ is_generated: false })).toBeNull();
  });

  it('drops a photograph whose credit is empty or blank', () => {
    expect(creditFor({ is_generated: false, credit: '' })).toBeNull();
    expect(creditFor({ is_generated: false, credit: '   ' })).toBeNull();
  });
});

describe('creditFor — a generated picture owes a disclosure instead', () => {
  it('keeps a generated picture that names no photographer', () => {
    // There is no one to name. The stair is a render of our own model.
    expect(creditFor({ is_generated: true })).toBe('');
  });

  it('still carries a credit where a generated picture has one', () => {
    expect(
      creditFor({
        is_generated: true,
        credit: 'Rendered from the Epocheye magic-window model of the palace',
      }),
    ).toBe('Rendered from the Epocheye magic-window model of the palace');
  });
});

describe('the two rules together, as the hook applies them', () => {
  it('shows a credited photograph', () => {
    expect(shows({ is_generated: false, credit: 'Photograph by X, CC0' })).toBe(
      true,
    );
  });

  it('shows a generated still that discloses itself', () => {
    expect(
      shows({
        is_generated: true,
        disclosure: 'A reconstruction, not a photograph.',
      }),
    ).toBe(true);
  });

  it('refuses a generated still with no disclosure, credit or not', () => {
    expect(shows({ is_generated: true, credit: 'Rendered by us' })).toBe(false);
  });

  it('refuses an uncredited photograph however good its caption', () => {
    expect(shows({ is_generated: false, disclosure: '' })).toBe(false);
  });

  it('drops the bad row ON ITS OWN, never its siblings', () => {
    // `what_the_board_says` carries two photographs and the whole point of the
    // stop is that they disagree with each other. One bad row must not take the
    // other with it and leave a visitor looking at half a dispute.
    const rows = [
      { is_generated: false, credit: 'Photograph by Dolon Prova, CC BY-SA 4.0' },
      { is_generated: false, credit: '' },
      { is_generated: false, credit: 'Photograph by Pinakpani, CC BY-SA 4.0' },
    ];
    expect(rows.filter(shows)).toHaveLength(2);
  });
});
