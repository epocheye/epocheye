/**
 * Bottom card shown when the user taps / searches a place that is not (yet) a
 * curated Epocheye site. Calm, on-brand "not available here" message rather
 * than dropping the user into a generic experience with no real content.
 */

import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Compass, X} from 'lucide-react-native';
import {FONTS} from '../../../core/constants/theme';

interface UnavailableSiteCardProps {
  placeName: string;
  bottom: number;
  onDismiss: () => void;
  /** Opens seed-free museum mode (tap-to-identify any object). */
  onExplore?: () => void;
}

const UnavailableSiteCard: React.FC<UnavailableSiteCardProps> = ({
  placeName: _placeName,
  bottom,
  onDismiss,
  onExplore,
}) => {
  return (
    <View
      className="absolute left-4 right-4 rounded-[14px] overflow-hidden bg-[#141414] border border-[rgba(201,168,76,0.35)]"
      style={[styles.cardShadow, {bottom}]}
      accessibilityRole="summary">
      <View className="flex-row items-start p-4">
        <View className="w-11 h-11 rounded-full bg-[rgba(201,168,76,0.12)] items-center justify-center mr-3">
          <Compass color="#C9A84C" size={20} />
        </View>
        <View className="flex-1 pr-2">
          <Text
            style={{fontFamily: FONTS.display, fontSize: 18, color: '#F5F0E8', lineHeight: 22}}
            numberOfLines={2}>
            Epocheye isn't here yet
          </Text>
          <Text
            style={{marginTop: 4, fontFamily: FONTS.sans, fontSize: 12, color: 'rgba(245,240,232,0.6)', lineHeight: 17}}
            numberOfLines={3}>
            Heritage sites near you aren't live in Epocheye yet.
          </Text>
          {onExplore ? (
            <Pressable
              onPress={onExplore}
              accessibilityRole="button"
              accessibilityLabel="Explore what's around you — tap any object"
              className="mt-3 self-start px-[14px] py-2 rounded-full bg-[#C9A84C]"
              style={({pressed}) => (pressed ? {opacity: 0.85} : undefined)}>
              <Text style={{fontFamily: FONTS.sansSemiBold, fontSize: 12, color: '#0D0D0D'}}>
                Explore what's around you →
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.06)] items-center justify-center">
          <X color="rgba(245,240,232,0.6)" size={15} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 8},
    elevation: 8,
  },
});

export default UnavailableSiteCard;
