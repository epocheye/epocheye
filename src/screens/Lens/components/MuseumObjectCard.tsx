/**
 * MuseumObjectCard — screen-space card for universal "museum mode".
 *
 * Anchored near the tapped point on the camera feed (clamped to the
 * viewport). Shows the identified object label as the title and types in
 * the streamed, hedged narration below. Visually identical to the seeded
 * IdentificationCard (same dark glass + amber border + montserrat) so the
 * seed-free experience looks first-class.
 *
 * Streaming is driven by the parent: it updates `narration` as chunks
 * arrive and flips `streaming` to false on done. This component owns no
 * network — it only renders.
 */

import React from 'react';
import { ActivityIndicator, Dimensions, Pressable, Text, View } from 'react-native';
import Animated, { FadeOut, SlideInUp } from 'react-native-reanimated';
import { X } from 'lucide-react-native';

const CARD_WIDTH = 300;
const CARD_EST_HEIGHT = 168;
const MARGIN = 16;

export interface MuseumObjectCardProps {
  /**
   * Screen point (dp) the card anchors to. On non-AR devices this is the
   * static tap point; on AR devices it updates every frame as the native
   * layer reprojects the world anchor, so the card follows the object.
   */
  anchor: { x: number; y: number };
  /** Identified object label (card title). Null while identifying. */
  label: string | null;
  /** Accumulated narration text streamed so far. */
  narration: string;
  /** True until the identify call returns a label. */
  identifying: boolean;
  /** True while narration chunks are still arriving. */
  streaming: boolean;
  /** Set when the run failed (shown in place of narration). */
  error: string | null;
  /**
   * AR tracking only: when false the anchor is off-screen / behind the
   * camera, so the card is hidden until it comes back into view. Defaults
   * to true (screen-space / non-AR path is always visible).
   */
  visible?: boolean;
  onDismiss: () => void;
}

/** Clamps the card's top-left so it stays fully on-screen near the tap. */
function clampPosition(anchor: { x: number; y: number }): {
  left: number;
  top: number;
} {
  const { width, height } = Dimensions.get('window');
  // Prefer centering horizontally on the tap, sitting just below the finger.
  let left = anchor.x - CARD_WIDTH / 2;
  let top = anchor.y + 24;
  left = Math.max(MARGIN, Math.min(left, width - CARD_WIDTH - MARGIN));
  top = Math.max(
    MARGIN,
    Math.min(top, height - CARD_EST_HEIGHT - MARGIN),
  );
  return { left, top };
}

const MuseumObjectCard: React.FC<MuseumObjectCardProps> = ({
  anchor,
  label,
  narration,
  identifying,
  streaming,
  error,
  visible = true,
  onDismiss,
}) => {
  // AR tracking: when the anchored object leaves the frame, hide the card
  // rather than parking it at a stale edge position.
  if (!visible) {
    return null;
  }

  const { left, top } = clampPosition(anchor);

  return (
    <Animated.View
      entering={SlideInUp.duration(260).springify()}
      exiting={FadeOut.duration(180)}
      style={{ position: 'absolute', left, top, width: CARD_WIDTH }}
      className="bg-[rgba(13,13,13,0.92)] rounded-[20px] p-5 border border-[rgba(203,168,98,0.25)]"
    >
      <Pressable
        className="absolute top-3 right-3 z-[1]"
        onPress={onDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <X size={16} color="#8C93A0" />
      </Pressable>

      {identifying ? (
        <View className="flex-row items-center gap-x-[10px]">
          <ActivityIndicator color="#CBA862" size="small" />
          <Text className="text-grey-muted text-[14px] font-montserrat">
            Looking at this…
          </Text>
        </View>
      ) : (
        <>
          <Text
            className="text-parchment text-[20px] font-montserrat-bold mb-1 pr-6"
            numberOfLines={2}
          >
            {label ?? 'This object'}
          </Text>

          {error ? (
            <Text className="text-grey-muted text-[13px] font-montserrat leading-5">
              {error}
            </Text>
          ) : (
            <Text className="text-[#C5C9D1] text-[13px] font-montserrat leading-5">
              {narration}
              {streaming && narration.length === 0
                ? 'Composing a short note…'
                : ''}
            </Text>
          )}

          {!error ? (
            <Text className="text-[#5A5F6B] text-[10px] font-montserrat mt-3 tracking-[0.4px]">
              AI impression · point and tap anything
            </Text>
          ) : null}
        </>
      )}
    </Animated.View>
  );
};

export default MuseumObjectCard;
