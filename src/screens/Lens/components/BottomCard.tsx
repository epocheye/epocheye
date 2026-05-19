import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Layers, ScanSearch, Sparkles} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import type {Place} from '../../../utils/api/places';
import {FONTS} from '../../../core/constants/theme';
import {getPlaceImage} from '../../../shared/utils';

export type LensDetectionState = 'searching' | 'matched' | 'not_found';

interface BottomCardProps {
  state: LensDetectionState;
  place: Place | null;
  locationDenied: boolean;
  onOpenStory: () => void;
  onOpenInfo: () => void;
  onScanObject: () => void;
  onBrowseMonuments: () => void;
  onSearchManually: () => void;
  /** Triggers Gemini heritage identification */
  onIdentify?: () => void;
  /** Whether an identification request is in-flight */
  identifyLoading?: boolean;
  /** Remaining free Gemini calls today (Infinity for premium) */
  remainingCalls?: number;
  /** Triggers HD Scan via SAM Lambda (premium only) */
  onHDScan?: () => void;
  /** Whether an HD scan request is in-flight */
  hdScanLoading?: boolean;
}

function formatPlaceSubline(place: Place): string {
  const year = (place as Place & {year?: string | number}).year;

  if (typeof year === 'number') {
    return `${place.city} · ${year}`;
  }

  if (typeof year === 'string' && year.trim().length > 0) {
    return `${place.city} · ${year}`;
  }

  return place.city;
}

const BottomCard: React.FC<BottomCardProps> = ({
  state,
  place,
  locationDenied,
  onOpenStory,
  onOpenInfo,
  onScanObject,
  onBrowseMonuments,
  onSearchManually,
  onIdentify,
  identifyLoading,
  remainingCalls,
  onHDScan,
  hdScanLoading,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute left-0 right-0 bottom-0 bg-[rgba(13,13,13,0.82)] rounded-tl-[20px] rounded-tr-[20px] px-6 pt-5"
      style={{paddingBottom: insets.bottom + 16}}>
      {state === 'searching' ? (
        <View className="flex-row items-center">
          <ActivityIndicator color="#E8A020" size="small" />
          <Text
            className="ml-[10px] text-[14px] text-grey-muted"
            style={{fontFamily: FONTS.regular}}>
            Looking for heritage sites near you...
          </Text>
        </View>
      ) : null}

      {state === 'matched' && place ? (
        <View>
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country} lens match`}
            fallbackUri={getPlaceImage(place.categories)}
            style={{
              width: '100%',
              height: 112,
              borderRadius: 12,
              marginBottom: 12,
              backgroundColor: '#1A1A1A',
            }}
            imageStyle={{borderRadius: 12}}
            loadingLabel="Loading monument visual..."
          />

          <Text
            className="text-parchment text-[18px]"
            style={{fontFamily: FONTS.bold}}>
            {place.name}
          </Text>
          <Text
            className="mt-0.5 text-grey-muted text-[13px]"
            style={{fontFamily: FONTS.regular}}>
            {formatPlaceSubline(place)}
          </Text>
          <Text
            className="mt-2 text-accent-amber text-[14px]"
            style={{fontFamily: FONTS.italic, fontStyle: 'italic'}}>
            Your ancestor was here.
          </Text>

          <View className="mt-4 flex-row gap-x-3">
            <TouchableOpacity
              className="flex-1 h-12 rounded-xl items-center justify-center bg-accent-amber"
              onPress={onOpenStory}>
              <Text
                className="text-[#0D0D0D] text-[15px]"
                style={{fontFamily: FONTS.bold}}>
                Open Story
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 h-12 rounded-xl items-center justify-center border-[1.5px] border-accent-amber bg-transparent"
              onPress={onOpenInfo}>
              <Text
                className="text-accent-amber text-[15px]"
                style={{fontFamily: FONTS.semiBold}}>
                Monument Info
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className="mt-3 h-12 rounded-xl border-[1.5px] border-accent-amber bg-transparent flex-row items-center justify-center gap-x-2"
            onPress={onScanObject}>
            <ScanSearch size={18} color="#E8A020" />
            <Text
              className="text-accent-amber text-[14px]"
              style={{fontFamily: FONTS.semiBold}}>
              Scan an object inside →
            </Text>
          </TouchableOpacity>

          {onIdentify && (
            <TouchableOpacity
              className="mt-[10px] h-12 rounded-xl bg-accent-amber flex-row items-center justify-center gap-x-2"
              onPress={onIdentify}
              disabled={identifyLoading}>
              {identifyLoading ? (
                <ActivityIndicator color="#0D0D0D" size="small" />
              ) : (
                <>
                  <Sparkles size={18} color="#0D0D0D" />
                  <Text
                    className="text-[#0D0D0D] text-[15px]"
                    style={{fontFamily: FONTS.bold}}>
                    Identify Heritage
                  </Text>
                </>
              )}
              {remainingCalls !== undefined &&
                remainingCalls !== Infinity &&
                !identifyLoading && (
                  <Text
                    className="text-[rgba(13,13,13,0.6)] text-[11px] ml-1"
                    style={{fontFamily: FONTS.medium}}>
                    {remainingCalls} left
                  </Text>
                )}
            </TouchableOpacity>
          )}

          {onHDScan && (
            <TouchableOpacity
              className="mt-2 h-[42px] rounded-xl border-[1.5px] border-[rgba(232,160,32,0.5)] bg-[rgba(232,160,32,0.1)] flex-row items-center justify-center gap-x-2"
              onPress={onHDScan}
              disabled={hdScanLoading}>
              {hdScanLoading ? (
                <ActivityIndicator color="#E8A020" size="small" />
              ) : (
                <>
                  <Layers size={16} color="#E8A020" />
                  <Text
                    className="text-accent-amber text-[13px]"
                    style={{fontFamily: FONTS.semiBold}}>
                    HD Scan
                  </Text>
                  <View className="bg-accent-amber rounded-[4px] px-[5px] py-[1px]">
                    <Text
                      className="text-[#0D0D0D] text-[9px]"
                      style={{fontFamily: FONTS.bold}}>
                      PRO
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {state === 'not_found' ? (
        <View>
          <Text
            className="text-parchment text-[15px] text-center"
            style={{fontFamily: FONTS.semiBold}}>
            {locationDenied
              ? 'Turn on location to discover heritage sites near you'
              : 'No heritage sites found nearby'}
          </Text>
          <Text
            className="mt-2 text-grey-muted text-[13px] text-center"
            style={{fontFamily: FONTS.regular}}>
            Try visiting a heritage site, or search for one below
          </Text>

          <View className="mt-4 flex-row gap-x-3">
            <Pressable
              className="flex-1 h-12 rounded-xl items-center justify-center bg-accent-amber"
              onPress={onBrowseMonuments}>
              <Text
                className="text-[#0D0D0D] text-[15px]"
                style={{fontFamily: FONTS.bold}}>
                Browse Monuments
              </Text>
            </Pressable>

            <Pressable
              className="flex-1 h-12 rounded-xl items-center justify-center border-[1.5px] border-accent-amber bg-transparent"
              onPress={onSearchManually}>
              <Text
                className="text-accent-amber text-[15px]"
                style={{fontFamily: FONTS.semiBold}}>
                Search Manually
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default BottomCard;
