/**
 * Dev-only overlay shown after the user taps Identify with devBypass on.
 *
 * Displays the captured photo with Gemini's bounding boxes drawn over it;
 * tapping a box opens a confirm card. Confirming fires SAM 3D on the
 * cropped region and closes the overlay.
 */

import React, { useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import type { DetectedObject } from '../../../services/geminiObjectDetectionService';

interface Props {
  imageBase64: string;
  objects: DetectedObject[];
  onCancel: () => void;
  onConfirm: (obj: DetectedObject) => void;
}

const BOX_COLOR = '#D4AF37';

const ObjectPickerOverlay: React.FC<Props> = ({
  imageBase64,
  objects,
  onCancel,
  onConfirm,
}) => {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<DetectedObject | null>(null);

  const imageUri = useMemo(() => `data:image/jpeg;base64,${imageBase64}`, [
    imageBase64,
  ]);

  const handleFrameLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFrame({ width, height });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={styles.root}
      pointerEvents="box-none"
    >
      <View style={styles.backdrop} />

      <View style={styles.frame} onLayout={handleFrameLayout}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />

        {frame.width > 0 &&
          objects.map((obj, idx) => {
            const [y0, x0, y1, x1] = obj.box_2d;
            const left = (x0 / 1000) * frame.width;
            const top = (y0 / 1000) * frame.height;
            const width = Math.max(24, ((x1 - x0) / 1000) * frame.width);
            const height = Math.max(24, ((y1 - y0) / 1000) * frame.height);
            return (
              <Pressable
                key={`${obj.name}-${idx}`}
                style={[styles.box, { left, top, width, height }]}
                onPress={() => setSelected(obj)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${obj.name}`}
              >
                <View style={styles.labelChip}>
                  <Text numberOfLines={1} style={styles.labelText}>
                    {obj.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
      </View>

      <Pressable
        style={styles.closeButton}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close picker"
      >
        <X size={18} color="#F5F0E8" />
      </Pressable>

      {objects.length === 0 && (
        <View style={styles.emptyBanner}>
          <Text style={styles.emptyText}>
            Nothing recognised — try another angle or closer to a single object.
          </Text>
        </View>
      )}

      {selected && (
        <Animated.View entering={FadeIn.duration(160)} style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Reconstruct this?</Text>
          <Text style={styles.confirmName}>{selected.name}</Text>
          <Text style={styles.confirmDesc}>{selected.description}</Text>
          <View style={styles.confirmRow}>
            <Pressable
              style={[styles.confirmBtn, styles.confirmBtnGhost]}
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.confirmBtnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, styles.confirmBtnPrimary]}
              onPress={() => {
                const chosen = selected;
                setSelected(null);
                onConfirm(chosen);
              }}
              accessibilityRole="button"
              accessibilityLabel="Reconstruct"
            >
              <Text style={styles.confirmBtnPrimaryText}>Reconstruct</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  frame: { flex: 1, position: 'relative' },
  image: { width: '100%', height: '100%' },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: BOX_COLOR,
    borderRadius: 6,
  },
  labelChip: {
    position: 'absolute',
    top: -22,
    left: 0,
    backgroundColor: BOX_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 160,
  },
  labelText: {
    color: '#0A0A0A',
    fontSize: 11,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBanner: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(26,20,16,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  emptyText: {
    color: '#F5F0E8',
    fontSize: 13,
    fontFamily: 'MontserratAlternates-Medium',
    textAlign: 'center',
  },
  confirmCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 40,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(14,10,8,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  confirmTitle: {
    color: '#B8AF9E',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'MontserratAlternates-SemiBold',
    marginBottom: 6,
  },
  confirmName: {
    color: '#F5F0E8',
    fontSize: 18,
    fontFamily: 'MontserratAlternates-Bold',
    marginBottom: 4,
  },
  confirmDesc: {
    color: '#B8AF9E',
    fontSize: 13,
    fontFamily: 'MontserratAlternates-Regular',
    marginBottom: 14,
  },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'transparent',
  },
  confirmBtnGhostText: {
    color: '#B8AF9E',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-SemiBold',
  },
  confirmBtnPrimary: {
    backgroundColor: BOX_COLOR,
  },
  confirmBtnPrimaryText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontFamily: 'MontserratAlternates-Bold',
  },
});

export default ObjectPickerOverlay;
