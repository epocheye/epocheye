import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Compass,
  Crown,
  Flame,
  Lock,
  Medal,
  Scroll,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { COLORS, FONTS, GOLD_GRADIENT } from '../../core/constants/theme';
import type { Badge } from '../../shared/utils/achievements';

interface Props {
  badges: Badge[];
  /** Cap the number of tiles shown in the row (rest are summarised elsewhere). */
  max?: number;
}

const ICONS: Record<string, LucideIcon> = {
  medal: Medal,
  flame: Flame,
  compass: Compass,
  crown: Crown,
  scroll: Scroll,
  sparkles: Sparkles,
};

/**
 * Horizontal achievement row. Earned badges render as a gold-gradient tile with
 * a dark glyph; locked badges render as a glass tile with a muted lock.
 */
const BadgeGrid: React.FC<Props> = ({ badges, max = 4 }) => {
  const shown = badges.slice(0, max);
  return (
    <View style={styles.row}>
      {shown.map(badge => {
        const Icon = ICONS[badge.icon] ?? Medal;
        return (
          <View key={badge.id} style={styles.cell}>
            {badge.earned ? (
              <LinearGradient
                colors={GOLD_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tile}>
                <Icon color={COLORS.bg} size={26} />
              </LinearGradient>
            ) : (
              <View style={[styles.tile, styles.tileLocked]}>
                <Lock color={COLORS.textTertiary} size={22} />
              </View>
            )}
            <Text
              numberOfLines={1}
              style={[styles.label, !badge.earned && styles.labelLocked]}>
              {badge.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', gap: 10, width: 64 },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLocked: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontFamily: FONTS.uiMedium,
    fontSize: 11,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  labelLocked: { color: COLORS.textTertiary },
});

export default BadgeGrid;
