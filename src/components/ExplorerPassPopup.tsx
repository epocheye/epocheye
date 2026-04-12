/**
 * A modal popup that nudges the user to get an Explorer Pass.
 * Shown once per session on the Home screen (if the user has no active pass).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { MapPin, Sparkles, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <MapPin color="#D4860A" size={22} />
            </View>
            <TouchableOpacity
              onPress={dismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X color="#6B6357" size={20} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Get Your Explorer Pass</Text>
          <Text style={styles.body}>
            Unlock heritage sites near you with a one-time Explorer Pass. The
            more places you pick, the less you pay per site.
          </Text>

          <TouchableOpacity
            onPress={handleGetPass}
            style={styles.cta}
            accessibilityRole="button"
          >
            <Sparkles color="#0A0A0A" size={18} />
            <Text style={styles.ctaText}>Choose Places</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={dismiss}
            style={styles.dismiss}
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  } as const,
  card: {
    width: '100%',
    backgroundColor: '#141414',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,134,10,0.25)',
    padding: 24,
  } as const,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  } as const,
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212,134,10,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  title: {
    color: '#F5F0E8',
    fontSize: 20,
    fontFamily: 'MontserratAlternates-Bold',
    lineHeight: 28,
  } as const,
  body: {
    color: '#B8AF9E',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    fontFamily: 'MontserratAlternates-Regular',
  } as const,
  cta: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#D4860A',
  } as const,
  ctaText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontFamily: 'MontserratAlternates-Bold',
  } as const,
  dismiss: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  dismissText: {
    color: '#6B6357',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Medium',
  } as const,
};

export default ExplorerPassPopup;
