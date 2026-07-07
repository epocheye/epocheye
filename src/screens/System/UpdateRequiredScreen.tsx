/**
 * UpdateRequiredScreen — the HARD version gate.
 *
 * Rendered by the root navigator (outside NavigationContainer, like LoginScreen)
 * when this build's versionCode is below the server's `min_supported_build`.
 * It is fully blocking: no back affordance, hardware-back is a no-op, and the
 * only action is to open the store listing. See src/utils/api/appConfig.
 */
import React, { useEffect } from 'react';
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ArrowUpCircle } from 'lucide-react-native';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../../core/constants/theme';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import type { AppConfig } from '../../utils/api/appConfig';

interface Props {
  config: AppConfig;
}

const UpdateRequiredScreen: React.FC<Props> = ({ config }) => {
  const { t } = useTranslation();

  // Swallow the Android hardware back button — this screen cannot be dismissed.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const onUpdate = () => {
    const url =
      Platform.OS === 'ios' ? config.ios_store_url : config.android_store_url;
    if (url) void Linking.openURL(url).catch(() => undefined);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <AnimatedLogo size={84} motion="pulse" variant="white" showRing={false} />

        <View style={styles.iconWrap}>
          <ArrowUpCircle size={28} color={COLORS.gold} />
        </View>

        <Text style={styles.title}>{t('update.requiredTitle')}</Text>
        <Text style={styles.body}>
          {config.message?.trim() ? config.message : t('update.requiredBody')}
        </Text>

        {config.latest_version ? (
          <Text style={styles.version}>
            {t('update.latestLabel', { version: config.latest_version })}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onUpdate}
        accessibilityRole="button"
        accessibilityLabel={t('update.cta')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
        <Text style={styles.ctaText}>{t('update.cta')}</Text>
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
  version: {
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

export default UpdateRequiredScreen;
