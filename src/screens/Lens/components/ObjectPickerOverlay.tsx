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
      className="absolute inset-0 z-[50]"
      pointerEvents="box-none"
    >
      <View className="absolute inset-0 bg-[rgba(0,0,0,0.94)]" />

      <View className="flex-1 relative" onLayout={handleFrameLayout}>
        <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />

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
                className="absolute border-2 border-[#D4AF37] rounded-[6px]"
                style={{ left, top, width, height }}
                onPress={() => setSelected(obj)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${obj.name}`}
              >
                <View className="absolute -top-[22px] left-0 bg-[#D4AF37] px-2 py-[2px] rounded-[4px] max-w-[160px]">
                  <Text numberOfLines={1} className="text-[#0A0A0A] text-[11px] font-montserrat-semibold">
                    {obj.name}
                  </Text>
                </View>
              </Pressable>
            );
          })}
      </View>

      <Pressable
        className="absolute top-12 right-4 w-9 h-9 rounded-[18px] bg-[rgba(0,0,0,0.7)] border border-[rgba(255,255,255,0.15)] items-center justify-center"
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close picker"
      >
        <X size={18} color="#F5F0E8" />
      </Pressable>

      {objects.length === 0 && (
        <View className="absolute top-[100px] left-6 right-6 p-[14px] rounded-xl bg-[rgba(26,20,16,0.92)] border border-[rgba(212,175,55,0.3)]">
          <Text className="text-parchment text-[13px] font-montserrat-medium text-center">
            Nothing recognised — try another angle or closer to a single object.
          </Text>
        </View>
      )}

      {selected && (
        <Animated.View entering={FadeIn.duration(160)} className="absolute left-4 right-4 bottom-10 p-[18px] rounded-2xl bg-[rgba(14,10,8,0.98)] border border-[rgba(212,175,55,0.4)]">
          <Text className="text-[#B8AF9E] text-[11px] tracking-[1px] uppercase font-montserrat-semibold mb-[6px]">
            What we see
          </Text>
          <Text className="text-parchment text-[18px] font-montserrat-bold mb-1">
            {selected.name}
          </Text>
          <Text className="text-[#B8AF9E] text-[13px] font-montserrat mb-[14px]">
            {selected.description}
          </Text>
          <View className="flex-row gap-[10px]">
            <Pressable
              className="flex-1 py-3 rounded-[10px] items-center justify-center border border-[rgba(255,255,255,0.12)] bg-transparent"
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel="Back to objects"
            >
              <Text className="text-[#B8AF9E] text-[14px] font-montserrat-semibold">Back</Text>
            </Pressable>
            <Pressable
              className="flex-1 py-3 rounded-[10px] items-center justify-center bg-[#D4AF37]"
              onPress={() => {
                const chosen = selected;
                setSelected(null);
                onConfirm(chosen);
              }}
              accessibilityRole="button"
              accessibilityLabel="View in 3D"
            >
              <Text className="text-[#0A0A0A] text-[14px] font-montserrat-bold">View in 3D</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default ObjectPickerOverlay;
