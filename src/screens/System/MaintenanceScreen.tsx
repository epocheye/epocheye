/**
 * MaintenanceScreen — the app-wide maintenance block.
 *
 * Rendered by the root navigator (outside NavigationContainer, like LoginScreen
 * and UpdateRequiredScreen) when the server reports maintenance mode ON and this
 * caller is not an admin. It is fully blocking: no back affordance, hardware-back
 * is a no-op, and the only ordinary action is to re-check.
 *
 * The admin door is a LONG-PRESS on the logo. It is deliberately undiscoverable
 * — a visible "admin login" button on a screen every user sees would invite
 * poking — and it exists because an admin who is signed out during an incident
 * would otherwise be locked out of their own app with no way back in.
 *
 * See src/utils/api/appConfig (evaluateMaintenance) for who gets blocked.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react-native';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../../core/constants/theme';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import type { Maintenance } from '../../utils/api/appConfig';

interface Props {
  info: Maintenance;
  /** Re-runs the gate check. Should resolve when the check completes. */
  onRetry: () => Promise<void> | void;
  /** Opens the login screen so an admin can sign in and pass the gate. */
  onAdminSignIn: () => void;
}

const MaintenanceScreen: React.FC<Props> = ({
  info,
  onRetry,
  onAdminSignIn,
}) => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);

  // Swallow the Android hardware back button — this screen cannot be dismissed.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleRetry = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await onRetry();
    } finally {
      // If the check clears the gate this component unmounts; guarding with a
      // mounted-ref would be noise, so just reset — React tolerates the no-op.
      setChecking(false);
    }
  };

  // Operator copy wins over the built-in translation when present.
  const title = info.title?.trim() ? info.title : t('maintenance.title');
  const body = info.message?.trim() ? info.message : t('maintenance.body');
  const eta = info.eta_text?.trim();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Pressable
          onLongPress={onAdminSignIn}
          delayLongPress={800}
          accessibilityRole="image"
          accessibilityLabel={t('maintenance.adminHint')}>
          <AnimatedLogo
            size={84}
            motion="pulse"
            variant="white"
            showRing={false}
          />
        </Pressable>

        <View style={styles.iconWrap}>
          <Wrench size={26} color={COLORS.gold} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {eta ? (
          <Text style={styles.eta}>{t('maintenance.etaLabel', { eta })}</Text>
        ) : null}
      </View>

      <Pressable
        onPress={handleRetry}
        disabled={checking}
        accessibilityRole="button"
        accessibilityState={{ disabled: checking }}
        accessibilityLabel={t('maintenance.cta')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
        {checking ? (
          <ActivityIndicator color={COLORS.bg} />
        ) : (
          <Text style={styles.ctaText}>{t('maintenance.cta')}</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.section,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.amberSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.heading,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.body,
    lineHeight: FONT_SIZES.body * 1.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  eta: {
    fontFamily: FONTS.uiMedium,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textTertiary,
  },
  cta: {
    height: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.section,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.button,
    color: COLORS.bg,
  },
});

export default MaintenanceScreen;
