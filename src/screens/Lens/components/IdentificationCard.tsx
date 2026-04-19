/**
 * IdentificationCard — 2D overlay card shown on the camera feed when
 * Gemini successfully identifies a heritage site or artifact.
 *
 * Positioned at the top of the screen. Supports loading, error,
 * premium-gated content (significance + fact), and offline badge.
 */

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import { Lock, WifiOff, X } from 'lucide-react-native';
import { FONTS } from '../../../core/constants/theme';
import type { GeminiIdentification } from '../../../services/geminiVisionService';

const AUTO_DISMISS_MS = 8_000;

interface IdentificationCardProps {
  identification: GeminiIdentification | null;
  isLoading: boolean;
  error: string | null;
  isPremium: boolean;
  isOffline?: boolean;
  locationContext?: string | null;
  onDismiss: () => void;
  onExpand: () => void;
  onUpgrade: () => void;
}

const IdentificationCard: React.FC<IdentificationCardProps> = ({
  identification,
  isLoading,
  error,
  isPremium,
  isOffline = false,
  locationContext = null,
  onDismiss,
  onExpand,
  onUpgrade,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (identification && !isLoading) {
      timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [identification, isLoading, onDismiss]);

  // Nothing to show
  if (!isLoading && !identification && !error) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInUp.duration(300).springify()}
      exiting={FadeOut.duration(200)}
      style={styles.container}
    >
      {/* Dismiss button */}
      <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={12}>
        <X size={16} color="#8C93A0" />
      </Pressable>

      {/* Offline badge */}
      {isOffline && (
        <View style={styles.offlineBadge}>
          <WifiOff size={10} color="#0D0D0D" />
          <Text style={styles.offlineBadgeText}>Saved offline</Text>
        </View>
      )}

      {/* Loading state */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#E8A020" size="small" />
          <Text style={styles.loadingText}>Identifying this heritage site...</Text>
        </View>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Identification result */}
      {!isLoading && identification && (
        <Pressable onPress={onExpand}>
          <Text style={styles.name}>{identification.name}</Text>

          {locationContext ? (
            <Text style={styles.locationContext} numberOfLines={2}>
              {locationContext}
            </Text>
          ) : null}

          {identification.period ? (
            <Text style={styles.period}>{identification.period}</Text>
          ) : null}

          {/* Significance — premium gated */}
          {isPremium ? (
            <Text style={styles.significance} numberOfLines={2}>
              {identification.significance}
            </Text>
          ) : identification.significance &&
            identification.significance !== 'Not identified as a heritage structure or artifact.' ? (
            <Pressable style={styles.lockedRow} onPress={onUpgrade}>
              <Lock size={12} color="#E8A020" />
              <Text style={styles.lockedText}>
                Unlock full details with Explorer Pass
              </Text>
            </Pressable>
          ) : null}

          {/* Fun fact — premium only */}
          {isPremium && identification.fact ? (
            <Text style={styles.fact}>{identification.fact}</Text>
          ) : null}

          {/* Tap hint */}
          <Text style={styles.tapHint}>Tap for more details</Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(13,13,13,0.9)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.25)',
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  offlineBadge: {
    position: 'absolute',
    top: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offlineBadgeText: {
    color: '#0D0D0D',
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  loadingText: {
    color: '#8C93A0',
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  errorText: {
    color: '#8C93A0',
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginBottom: 2,
  },
  period: {
    color: '#E8A020',
    fontSize: 13,
    fontFamily: FONTS.medium,
    marginBottom: 10,
  },
  locationContext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    marginBottom: 8,
  },
  significance: {
    color: '#C5C9D1',
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 20,
    marginBottom: 8,
  },
  fact: {
    color: '#E8A020',
    fontSize: 13,
    fontFamily: FONTS.mediumItalic ?? FONTS.italic,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 8,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    marginVertical: 8,
  },
  lockedText: {
    color: '#E8A020',
    fontSize: 12,
    fontFamily: FONTS.semiBold,
  },
  tapHint: {
    color: '#5A5F6B',
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
});

export default IdentificationCard;
