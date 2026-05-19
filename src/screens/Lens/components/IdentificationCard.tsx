/**
 * IdentificationCard — 2D overlay card shown on the camera feed when
 * Gemini successfully identifies a heritage site or artifact.
 *
 * Positioned at the top of the screen. Supports loading, error,
 * premium-gated content (significance + fact), and offline badge.
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {FadeOut, SlideInUp} from 'react-native-reanimated';
import {AlertTriangle, Lock, WifiOff, X} from 'lucide-react-native';
import {FONTS} from '../../../core/constants/theme';
import type {GeminiIdentification} from '../../../services/geminiVisionService';
import ReportIssueModal from '../../../components/ui/ReportIssueModal';

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
  const [reportOpen, setReportOpen] = useState(false);

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

  if (!isLoading && !identification && !error) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInUp.duration(300).springify()}
      exiting={FadeOut.duration(200)}
      className="absolute top-[100px] left-4 right-4 bg-[rgba(13,13,13,0.9)] rounded-[20px] p-5 border border-[rgba(232,160,32,0.25)]">
      <Pressable
        className="absolute top-3 right-3 z-[1]"
        onPress={onDismiss}
        hitSlop={12}>
        <X size={16} color="#8C93A0" />
      </Pressable>

      {isOffline && (
        <View className="absolute top-3 left-4 flex-row items-center gap-x-1 bg-accent-amber rounded-lg px-2 py-[3px]">
          <WifiOff size={10} color="#0D0D0D" />
          <Text className="text-[#0D0D0D] text-[10px] font-montserrat-bold">
            Saved offline
          </Text>
        </View>
      )}

      {isLoading && (
        <View className="flex-row items-center gap-x-[10px]">
          <ActivityIndicator color="#E8A020" size="small" />
          <Text className="text-grey-muted text-[14px] font-montserrat">
            Identifying this heritage site...
          </Text>
        </View>
      )}

      {!isLoading && error && (
        <>
          <Text className="text-grey-muted text-[14px] font-montserrat text-center">
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => setReportOpen(true)}
            className="mt-[10px] self-center flex-row items-center gap-x-[6px] py-[6px] px-[10px] rounded-[10px] border border-[rgba(201,168,76,0.3)] bg-ob-goldSubtle"
            hitSlop={6}>
            <AlertTriangle color="#C9A84C" size={12} />
            <Text className="text-ob-gold text-[11px] font-montserrat-medium">
              Report issue
            </Text>
          </TouchableOpacity>
          <ReportIssueModal
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
          />
        </>
      )}

      {!isLoading && identification && (
        <Pressable onPress={onExpand}>
          <Text className="text-parchment text-[20px] font-montserrat-bold mb-0.5">
            {identification.name}
          </Text>

          {locationContext ? (
            <Text
              className="text-[rgba(255,255,255,0.6)] text-[12px] leading-[17px] font-montserrat mb-2"
              numberOfLines={2}>
              {locationContext}
            </Text>
          ) : null}

          {identification.period ? (
            <Text className="text-accent-amber text-[13px] font-montserrat-medium mb-[10px]">
              {identification.period}
            </Text>
          ) : null}

          {isPremium ? (
            <Text
              className="text-[#C5C9D1] text-[13px] font-montserrat leading-5 mb-2"
              numberOfLines={2}>
              {identification.significance}
            </Text>
          ) : identification.significance &&
            identification.significance !==
              'Not identified as a heritage structure or artifact.' ? (
            <Pressable
              className="flex-row items-center gap-x-[6px] my-2"
              onPress={onUpgrade}>
              <Lock size={12} color="#E8A020" />
              <Text className="text-accent-amber text-[12px] font-montserrat-semibold">
                Unlock full details with Passport
              </Text>
            </Pressable>
          ) : null}

          {isPremium && identification.fact ? (
            <Text
              className="text-accent-amber text-[13px] leading-5 mb-2"
              style={{
                fontFamily: FONTS.mediumItalic ?? FONTS.italic,
                fontStyle: 'italic',
              }}>
              {identification.fact}
            </Text>
          ) : null}

          <Text className="text-[#5A5F6B] text-[11px] font-montserrat mt-1">
            Tap for more details
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

export default IdentificationCard;
