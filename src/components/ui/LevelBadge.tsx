import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../../core/constants/theme';

interface Props {
  /** Number of sites visited — drives the explorer rank. */
  sites: number;
  /** Compact variant drops the "LV" prefix and tightens padding. */
  compact?: boolean;
}

interface Rank {
  level: number;
  title: string;
}

/**
 * Maps the user's visited-site count to an explorer rank. Pure presentational
 * derivation — no new data, just reshapes a value the screens already hold.
 */
export function rankForSites(sites: number): Rank {
  if (sites >= 25) return { level: 5, title: 'Chronicler' };
  if (sites >= 15) return { level: 4, title: 'Historian' };
  if (sites >= 8) return { level: 3, title: 'Pathfinder' };
  if (sites >= 3) return { level: 2, title: 'Wayfarer' };
  return { level: 1, title: 'Wanderer' };
}

/**
 * Sky-tinted pill showing the explorer level + title (e.g. "LV 2 · Wayfarer").
 */
const LevelBadge: React.FC<Props> = ({ sites, compact }) => {
  const { level, title } = rankForSites(sites);
  return (
    <View style={[styles.pill, compact && styles.pillCompact]}>
      <Text style={styles.level}>{compact ? `${level}` : `LV ${level}`}</Text>
      <View style={styles.dot} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 40,
    backgroundColor: COLORS.skyGlow,
    borderWidth: 1,
    borderColor: 'rgba(97,166,211,0.35)',
  },
  pillCompact: { paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  level: { fontFamily: FONTS.sansBold, fontSize: 12, color: COLORS.skyLight },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(143,195,226,0.6)',
  },
  title: { fontFamily: FONTS.sansSemiBold, fontSize: 12, color: COLORS.textPrimary },
});

export default LevelBadge;
