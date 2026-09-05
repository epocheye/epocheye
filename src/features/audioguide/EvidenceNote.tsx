/**
 * EvidenceNote — what a visitor is owed about how well this stop is known.
 *
 * THE PROBLEM. Three of the palace's eight stops are not CONFIRMED — `the_stair`
 * and `the_small_room` are INFERRED, `what_the_board_says` is DISPUTED — and the
 * narration is scrupulous about it in words. The interface said nothing at all:
 * `audio_clips.tier` arrived on every clip (audio/types.ts:35) and was rendered
 * nowhere, and the only two places `.tier` was read in the whole app were a
 * console log (PointLearnStep.tsx:249) and the magic window's figure card
 * (MagicWindowScreen.tsx:555). A visitor had to listen to the whole clip to
 * learn that a room's shape was worked out rather than recorded.
 *
 * ── WHY CONFIRMED RENDERS NOTHING ───────────────────────────────────────────
 *
 * Five of eight stops are CONFIRMED. A badge on all eight is wallpaper, and
 * wallpaper is exactly the bibliography this was not supposed to become — a mark
 * that appears everywhere carries no information anywhere. So silence is the
 * default and silence MEANS something: this is recorded. Three stops speak up out
 * of eight, which is a low enough rate that a visitor notices when one does.
 *
 * It also fails safe in the direction that matters. A tier this component does
 * not recognise, or a clip with no tier at all, renders nothing — the same as
 * CONFIRMED. That is the wrong-way-round risk and it is accepted deliberately:
 * the alternative is a component that shouts "uncertain" at a stop whose data
 * simply has not loaded, which would teach a visitor to ignore it.
 *
 * ── WHY THE WORDS ARE COMPOSED HERE, WHEN THE RESTORATION CAPTION IS NOT ────
 *
 * `restoration_caption` is authored per clip and is never composed client-side
 * from `tier` and `source_ids`, because it says WHICH PART of a specific picture
 * is a guess — content only a curator can write. This is a different job: it
 * translates one closed, CHECK-constrained vocabulary term into plain English.
 * `AudioTier` is `'CONFIRMED' | 'INFERRED' | 'DISPUTED'` and nothing else
 * (migration 076), so a three-entry map is exhaustive and cannot drift from the
 * data. That is what i18n is for.
 *
 * The wording avoids the vocabulary itself. "INFERRED" tells a visitor nothing;
 * "Worked out, not recorded" tells them the thing the word is standing in for.
 *
 * ── IT IS A STATEMENT, NOT A LINK ───────────────────────────────────────────
 *
 * Nothing here expands, and nothing opens a source list. The moment this becomes
 * tappable it becomes a bibliography, and the sources are already spoken in the
 * narration where they belong. One line, always visible, never in the way.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CircleHelp, TriangleAlert } from 'lucide-react-native';

import type { AudioTier } from '../../utils/api/audio/types';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../core/constants/theme';

/** i18n key per tier. CONFIRMED is absent on purpose — it renders nothing. */
const TIER_KEY: Partial<Record<AudioTier, string>> = {
  INFERRED: 'evidence.inferred',
  DISPUTED: 'evidence.disputed',
};

/** True when this tier has something to say. Exported so callers can ask. */
export function tierSpeaks(tier: AudioTier | undefined | null): boolean {
  return !!tier && tier in TIER_KEY;
}

export interface EvidenceNoteProps {
  tier: AudioTier | undefined | null;
  /**
   * 'line' — icon and a full sentence, for a stop the visitor is standing on.
   *
   * 'mark' — the icon and one or two words, for a row in the stop list. This is
   * the variant that satisfies the actual requirement: a visitor scanning the
   * list can see which stops are shaky BEFORE pressing play on any of them.
   */
  variant?: 'line' | 'mark';
}

const EvidenceNote: React.FC<EvidenceNoteProps> = ({ tier, variant = 'line' }) => {
  const { t } = useTranslation();
  if (!tierSpeaks(tier)) return null;
  const key = TIER_KEY[tier as AudioTier] as string;
  const disputed = tier === 'DISPUTED';
  const Icon = disputed ? TriangleAlert : CircleHelp;
  const colour = disputed ? COLORS.amber : COLORS.textSecondary;
  const mark = variant === 'mark';

  return (
    <View
      style={[styles.root, mark && styles.rootMark]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t(`${key}.full`)}>
      <Icon size={mark ? 12 : 14} color={colour} />
      <Text style={[styles.text, mark && styles.textMark, { color: colour }]}>
        {t(mark ? `${key}.short` : `${key}.full`)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    // A hair of breathing room, and no box. A bordered pill would read as a
    // warning banner; this is a note, and the stop is still worth hearing.
    paddingTop: 2,
  },
  rootMark: { gap: 4, paddingTop: 0 },
  text: {
    flex: 1,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.caption,
    lineHeight: 17,
  },
  // No flex in the row variant: it sits beside a duration, not across a column.
  textMark: { flex: 0, fontSize: 11, lineHeight: 14 },
});

export default EvidenceNote;
