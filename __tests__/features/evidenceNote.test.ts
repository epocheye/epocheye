/**
 * A VISITOR CAN TELL WHICH PARTS ARE KNOWN — and the silence is load-bearing.
 *
 * `audio_clips.tier` reached every clip and was rendered nowhere: the only two
 * places `.tier` was read in the whole app were a console log
 * (PointLearnStep.tsx:249) and the magic window's figure card
 * (MagicWindowScreen.tsx:555). Three of the palace's eight stops are not
 * CONFIRMED and a visitor had to hear the whole clip to find that out.
 *
 * What is pinned here is the rule that keeps the fix from becoming the
 * bibliography it was not supposed to become: CONFIRMED SAYS NOTHING. Five of
 * eight stops are CONFIRMED, so a mark on all eight would appear everywhere and
 * therefore mean nothing anywhere. The silence is the signal, which makes
 * "renders nothing" a behaviour worth a test rather than an omission.
 *
 * The failure modes are asserted in both directions, because they are not
 * symmetric. Shouting "uncertain" at a CONFIRMED stop is a lie about the
 * evidence. Staying quiet on a stop whose tier has not loaded is a gap. The
 * second is the accepted one — see the component header — and it is asserted so
 * that accepting it stays a decision rather than a bug someone later "fixes".
 */
import { tierSpeaks } from '../../src/features/audioguide/EvidenceNote';
import type { AudioTier } from '../../src/utils/api/audio/types';

describe('tierSpeaks — the exception is marked, the rule is not', () => {
  it('says nothing for CONFIRMED', () => {
    expect(tierSpeaks('CONFIRMED')).toBe(false);
  });

  it('speaks for INFERRED and DISPUTED', () => {
    expect(tierSpeaks('INFERRED')).toBe(true);
    expect(tierSpeaks('DISPUTED')).toBe(true);
  });

  it('stays quiet rather than guessing when there is no tier at all', () => {
    // A stop with no clip, or a payload from before migration 076. Silence is
    // the deliberate failure direction: a component that cried "uncertain" at
    // unloaded data would train a visitor to ignore it everywhere.
    expect(tierSpeaks(undefined)).toBe(false);
    expect(tierSpeaks(null)).toBe(false);
    expect(tierSpeaks('' as AudioTier)).toBe(false);
  });

  it('stays quiet on a tier it does not recognise', () => {
    // AudioTier is CHECK-constrained to three values (migration 076), so this
    // cannot happen from our own backend — the assertion is about what happens
    // if that ever widens, and the answer must not be a crash or a false alarm.
    expect(tierSpeaks('PROBABLY' as AudioTier)).toBe(false);
  });
});

describe('the palace, stop by stop', () => {
  // Exactly the tiers prod holds for tipu-summer-palace-bengaluru, read from
  // audio_clips on 2026-09-05. If a stop is ever re-tiered, this is where the
  // change shows up as a deliberate edit.
  const PALACE: Array<[string, AudioTier]> = [
    ['palace_overview', 'CONFIRMED'],
    ['into_the_shade', 'CONFIRMED'],
    ['the_pillars', 'CONFIRMED'],
    ['two_storeys_one_room', 'CONFIRMED'],
    ['the_stair', 'INFERRED'],
    ['the_lost_colour', 'CONFIRMED'],
    ['the_small_room', 'INFERRED'],
    ['what_the_board_says', 'DISPUTED'],
  ];

  it('marks exactly the three stops that are not CONFIRMED', () => {
    const marked = PALACE.filter(([, tier]) => tierSpeaks(tier)).map(([k]) => k);
    expect(marked).toEqual(['the_stair', 'the_small_room', 'what_the_board_says']);
  });

  it('leaves the majority silent, which is what makes the mark legible', () => {
    const silent = PALACE.filter(([, tier]) => !tierSpeaks(tier));
    expect(silent).toHaveLength(5);
    // Three in eight is rare enough to notice. If this ever inverts, the mark
    // has become wallpaper and the design has failed on its own terms.
    expect(PALACE.length - silent.length).toBeLessThan(silent.length);
  });
});
