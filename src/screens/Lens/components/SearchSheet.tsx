import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import type {Place} from '../../../utils/api/places';
import {FONTS} from '../../../core/constants/theme';
import {getPlaceImage} from '../../../shared/utils';

export interface SearchSheetRef {
  open: () => void;
  close: () => void;
}

interface SearchSheetProps {
  places: Place[];
  onSelectPlace: (place: Place) => void;
}

const SearchSheet = forwardRef<SearchSheetRef, SearchSheetProps>(
  ({places, onSelectPlace}, ref) => {
    const sheetRef = useRef<BottomSheet>(null);
    const [query, setQuery] = useState('');

    const snapPoints = useMemo(() => ['70%'], []);

    useImperativeHandle(ref, () => ({
      open: () => {
        sheetRef.current?.snapToIndex(0);
      },
      close: () => {
        sheetRef.current?.close();
      },
    }));

    const filteredPlaces = useMemo(() => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        return places;
      }

      return places.filter(place => {
        const categoryMatch = place.categories.some(category =>
          category.toLowerCase().includes(normalized),
        );

        return (
          place.name.toLowerCase().includes(normalized) ||
          place.city.toLowerCase().includes(normalized) ||
          place.country.toLowerCase().includes(normalized) ||
          categoryMatch
        );
      });
    }, [places, query]);

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}>
        <View className="flex-1 px-5">
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search monuments..."
            placeholderTextColor="#666666"
            style={styles.input}
          />

          <BottomSheetFlatList<Place>
            data={filteredPlaces}
            keyExtractor={(item: Place) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{paddingBottom: 24}}
            renderItem={({item}: {item: Place}) => (
              <Pressable
                className="flex-row items-center border-b border-[rgba(255,255,255,0.08)] py-[14px]"
                onPress={() => {
                  onSelectPlace(item);
                  sheetRef.current?.close();
                }}>
                <ResolvedSubjectImage
                  subject={item.name}
                  context={`${item.city} ${item.country} ${item.categories.join(', ')}`}
                  fallbackUri={getPlaceImage(item.categories)}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 10,
                    backgroundColor: '#1A1A1A',
                  }}
                  imageStyle={{borderRadius: 10}}
                  loadingLabel="Loading..."
                />

                <View className="flex-1 ml-3">
                  <Text
                    className="text-parchment text-[15px]"
                    style={{fontFamily: FONTS.semiBold}}>
                    {item.name}
                  </Text>
                  <Text
                    className="mt-0.5 text-grey-muted text-[12px]"
                    style={{fontFamily: FONTS.regular}}>
                    {item.city} · {(item.distance_meters / 1000).toFixed(1)} km
                    away
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text
                className="mt-7 text-grey-muted text-center text-[13px]"
                style={{fontFamily: FONTS.regular}}>
                No monuments match your search.
              </Text>
            }
          />
        </View>
      </BottomSheet>
    );
  },
);

// BottomSheet-specific styling and BottomSheetTextInput must remain in StyleSheet
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
  // BottomSheetTextInput does not accept className — keep as style object
  input: {
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.regular,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
});

SearchSheet.displayName = 'SearchSheet';

export default SearchSheet;
