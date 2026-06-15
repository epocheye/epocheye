/**
 * A modal popup that nudges the user to get a Passport.
 * Shown once per session on the Home screen (if the user has no active pass).
 *
 * Premium redesign: dark glass card, gold-gradient medallion + CTA, Cormorant
 * display title, hairline border — matching the Explorer Pass paywall mockup.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {Crown, X} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {COLORS, FONTS, GOLD_GRADIENT} from '../core/constants/theme';

const SESSION_KEY = '@epocheye/explorer_pass_popup_shown';

export interface ExplorerPassPopupProps {
  /** Whether the user currently has an active pass. If true, the popup never shows. */
  hasActivePass: boolean;
  /** Called when the user taps "Choose Places" */
  onGetPass: () => void;
}

const ExplorerPassPopup: React.FC<ExplorerPassPopupProps> = ({
  hasActivePass,
  onGetPass,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasActivePass) return;

    let cancelled = false;
    (async () => {
      const shown = await AsyncStorage.getItem(SESSION_KEY);
      if (!cancelled && shown !== 'true') {
        // Small delay so the home screen settles first
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 2000);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasActivePass]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    await AsyncStorage.setItem(SESSION_KEY, 'true');
  }, []);

  const handleGetPass = useCallback(async () => {
    setVisible(false);
    await AsyncStorage.setItem(SESSION_KEY, 'true');
    onGetPass();
  }, [onGetPass]);

  if (hasActivePass) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.iconCircle}>
              <Crown color={COLORS.bg} size={24} fill={COLORS.bg} />
            </LinearGradient>
            <TouchableOpacity
              onPress={dismiss}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <X color={COLORS.textTertiary} size={20} />
            </TouchableOpacity>
          </View>

          <Text style={styles.eyebrow}>EXPLORER PASS</Text>
          <Text style={styles.title}>Unlock every era</Text>
          <Text style={styles.body}>
            Get a one-time Passport to the heritage sites near you. The more
            places you pick, the less you pay per site.
          </Text>

          <TouchableOpacity onPress={handleGetPass} accessibilityRole="button">
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.cta}>
              <Crown color={COLORS.bg} size={18} fill={COLORS.bg} />
              <Text style={styles.ctaText}>Choose places</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={dismiss}
            style={styles.dismiss}
            accessibilityRole="button">
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,12,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.cardElevated,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FONTS.uiMedium,
    fontSize: 11,
    letterSpacing: 2.6,
    color: COLORS.gold,
    marginBottom: 8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontFamily: FONTS.display,
    lineHeight: 34,
  },
  body: {
    color: COLORS.textTertiary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    fontFamily: FONTS.ui,
  },
  cta: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    color: COLORS.bg,
    fontSize: 16,
    fontFamily: FONTS.uiMedium,
  },
  dismiss: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: COLORS.textTertiary,
    fontSize: 14,
    fontFamily: FONTS.ui,
  },
});

export default ExplorerPassPopup;
