import React, {forwardRef, useImperativeHandle, useMemo, useRef} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import BottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {MapPin} from 'lucide-react-native';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import type {Place} from '../../../utils/api/places';
import {getPlaceImage} from '../../../shared/utils';

export interface MonumentInfoSheetRef {
  open: () => void;
  close: () => void;
}

interface MonumentInfoSheetProps {
  place: Place | null;
}

const MonumentInfoSheet = forwardRef<
  MonumentInfoSheetRef,
  MonumentInfoSheetProps
>(({place}, ref) => {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%'], []);

  useImperativeHandle(ref, () => ({
    open: () => {
      sheetRef.current?.snapToIndex(0);
    },
    close: () => {
      sheetRef.current?.close();
    },
  }));

  const fullAddress =
    place?.formatted ||
    [place?.address_line1, place?.city, place?.country]
      .filter(Boolean)
      .join(', ');

  const distanceKm = place
    ? `${(place.distance_meters / 1000).toFixed(1)} km away`
    : '--';

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}>
      <BottomSheetScrollView
        contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 24}}>
        <Text className="text-parchment text-[20px] leading-7 font-ui-semibold">
          {place?.name ?? 'Monument'}
        </Text>

        {place?.name ? (
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country} monument info`}
            fallbackUri={getPlaceImage(place.categories)}
            enableRemoteResolve
            style={{marginTop: 12, width: '100%', height: 140, borderRadius: 12, backgroundColor: '#1A1A1A'}}
            imageStyle={{borderRadius: 12}}
            loadingLabel="Loading monument visual..."
          />
        ) : null}

        <Text className="mt-[10px] text-grey-muted text-[14px] leading-5 font-ui">
          {fullAddress}
        </Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {(place?.categories ?? []).map(category => (
            <View
              key={category}
              className="rounded-[20px] border border-[rgba(203,168,98,0.3)] px-[10px] py-[5px]">
              <Text className="text-accent-amber text-[12px] font-ui-medium capitalize">
                {category}
              </Text>
            </View>
          ))}
        </View>

        <View className="mt-5 flex-row items-center">
          <MapPin size={16} color="#CBA862" />
          <Text className="ml-2 text-parchment text-[14px] font-ui-medium">
            {distanceKm}
          </Text>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

// BottomSheet-specific styling must remain in StyleSheet — library reads these as plain objects
const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#0D0D0D',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
  },
});

MonumentInfoSheet.displayName = 'MonumentInfoSheet';

export default MonumentInfoSheet;
