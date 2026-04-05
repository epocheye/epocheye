import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { MapPin } from 'lucide-react-native';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import type { Place } from '../../../utils/api/places';
import { FONTS } from '../../../core/constants/theme';

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
>(({ place }, ref) => {
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
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{place?.name ?? 'Monument'}</Text>

        {place?.name ? (
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country} monument info`}
            style={styles.infoImage}
            imageStyle={styles.infoImage}
            loadingLabel="Loading monument visual..."
          />
        ) : null}

        <Text style={styles.address}>{fullAddress}</Text>

        <View style={styles.categoriesWrap}>
          {(place?.categories ?? []).map(category => (
            <View key={category} style={styles.categoryPill}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          ))}
        </View>

        <View style={styles.distanceRow}>
          <MapPin size={16} color="#E8A020" />
          <Text style={styles.distanceText}>{distanceKm}</Text>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 28,
    fontFamily: FONTS.bold,
  },
  infoImage: {
    marginTop: 12,
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  address: {
    marginTop: 10,
    color: '#8C93A0',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.regular,
  },
  categoriesWrap: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryText: {
    color: '#E8A020',
    fontSize: 12,
    fontFamily: FONTS.medium,
    textTransform: 'capitalize',
  },
  distanceRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
});

MonumentInfoSheet.displayName = 'MonumentInfoSheet';

export default MonumentInfoSheet;
