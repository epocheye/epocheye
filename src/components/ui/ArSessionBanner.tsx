/**
 * ArSessionBanner — tells the visitor, in plain words, that the AR view has lost its
 * place, and offers the one thing that might help.
 *
 * WHY IT IS A BANNER AND NOT A DIALOG. Every one of these conditions is transient and
 * environmental: too dark, too plain a floor, moving too fast, the phone getting warm.
 * A modal would stop a tour for something that usually fixes itself in two seconds.
 * This sits over the feed, says what is happening, and gets out of the way — the rule
 * already written down in `ARCapabilityNotice.tsx`: inform, never block.
 *
 * WHY IT IS NOT A TOAST. `Toast` self-dismisses after ~2.8 s. A visitor standing in a
 * dark room needs the message to stay up for as long as the room is dark, and to
 * disappear the moment it is not. Persistence tied to the actual condition is the
 * whole point, so this is driven by `useArSessionHealth` and never by a timer.
 *
 * The visual language copies `StatusPill` from the journey (JourneyUi.tsx) — one calm
 * line on a solid-enough scrim to stay legible over a bright daylight camera feed, gold
 * accent, no spinner. Deliberately not NativeWind: this renders over a live ARCore
 * surface where absolute layout and an opaque backing matter more than utility classes.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Eye, Flame, RotateCcw } from 'lucide-react-native';

import { COLORS, FONTS } from '../../core/constants/theme';
import type { ArSessionHealth } from '../../shared/hooks/useArSessionHealth';

interface Props {
  health: ArSessionHealth;
  /** Called by "Try again". Only rendered when the cause is actually retryable. */
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ArSessionBanner({ health, onRetry, style }: Props) {
  const { t } = useTranslation();

  // Nothing to say is the common case, and saying nothing must cost nothing.
  if (health.severity === 'ok' || !health.message) return null;

  const Icon = health.cause === 'thermal' ? Flame : Eye;
  const tint = health.severity === 'degraded' ? COLORS.gold : COLORS.textPrimary;

  return (
    <View
      style={[styles.wrap, style]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Icon size={18} color={COLORS.gold} />
          <Text style={[styles.message, { color: tint }]}>{health.message}</Text>
        </View>
        {health.canRetry && onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('arSession.retry')}
            style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          >
            <RotateCcw size={14} color={COLORS.gold} />
            <Text style={styles.retryText}>{t('arSession.retry')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sits below the top bar rather than at the very top, so it never collides with a
  // close button or a step counter on the screens that have one.
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 96,
    alignItems: 'center',
  },
  card: {
    // Solid enough to stay readable against a sunlit courtyard.
    backgroundColor: 'rgba(10,10,12,0.82)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    maxWidth: 420,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  message: {
    flex: 1,
    fontFamily: FONTS.uiMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  retryPressed: { opacity: 0.7 },
  retryText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 13,
    color: COLORS.gold,
  },
});
