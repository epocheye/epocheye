/**
 * OfflineInline — the inline "this part needs a connection" empty state.
 *
 * Purely presentational: it does NOT read the network context. Screens decide when
 * to show it, so the same component works as a body replacement (AI Guide, Daily),
 * a notice above a form (Suggest a site), or an overlay (the scan screen).
 *
 * It replaces a screen's BODY, never the screen — the header and back affordance
 * stay, so going offline can never trap the user.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../../core/constants/theme';

interface OfflineInlineProps {
  /** Overrides the default heading. */
  title?: string;
  /** Overrides the default explanation — say what THIS screen needs the network for. */
  message?: string;
  /** Renders a retry button when provided. */
  onRetry?: () => void;
  /** Compact variant: smaller glyph and tighter padding, for use above a form. */
  compact?: boolean;
  style?: ViewStyle;
}

const OfflineInline: React.FC<OfflineInlineProps> = ({
  title,
  message,
  onRetry,
  compact = false,
  style,
}) => {
  const { t } = useTranslation();

  return (
    <View
      style={[compact ? styles.rootCompact : styles.root, style]}
      accessibilityRole="alert">
      <View style={compact ? styles.glyphCompact : styles.glyph}>
        <WifiOff size={compact ? 16 : 26} color={COLORS.textTertiary} />
      </View>
      <Text style={compact ? styles.titleCompact : styles.title}>
        {title ?? t('offline.inlineTitle')}
      </Text>
      <Text style={compact ? styles.messageCompact : styles.message}>
        {message ?? t('offline.inlineMessage')}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={styles.retryBtn}
          accessibilityRole="button">
          <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.section,
  },
  // Bare on purpose — the compact variant is dropped INSIDE existing cards and
  // forms, where its own background/border would read as a card within a card.
  rootCompact: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  glyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgWarm,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
    marginBottom: SPACING.lg,
  },
  glyphCompact: { marginBottom: SPACING.sm },
  title: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.subtitle,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  titleCompact: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.body,
    lineHeight: FONT_SIZES.body * 1.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  messageCompact: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  retryBtn: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
    backgroundColor: COLORS.bgWarm,
  },
  retryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
  },
});

export default OfflineInline;
