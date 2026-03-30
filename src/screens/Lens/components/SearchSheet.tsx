import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { Place } from '../../../utils/api/places';
import { FONTS } from '../../../core/constants/theme';

export interface SearchSheetRef {
  open: () => void;
  close: () => void;
}

interface SearchSheetProps {
  places: Place[];
  onSelectPlace: (place: Place) => void;
}

const SearchSheet = forwardRef<SearchSheetRef, SearchSheetProps>(
  ({ places, onSelectPlace }, ref) => {
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
        handleIndicatorStyle={styles.handle}
      >
        <View style={styles.content}>
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
            contentContainerStyle={styles.listContent}
            renderItem={({ item }: { item: Place }) => (
              <Pressable
                style={styles.item}
                onPress={() => {
                  onSelectPlace(item);
                  sheetRef.current?.close();
                }}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.city} · {(item.distance_meters / 1000).toFixed(1)} km
                  away
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No monuments match your search.
              </Text>
            }
          />
        </View>
      </BottomSheet>
    );
  },
);

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
    flex: 1,
    paddingHorizontal: 20,
  },
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
  listContent: {
    paddingBottom: 24,
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },
  itemMeta: {
    marginTop: 2,
    color: '#8C93A0',
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  emptyText: {
    marginTop: 28,
    color: '#8C93A0',
    textAlign: 'center',
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
});

SearchSheet.displayName = 'SearchSheet';

export default SearchSheet;
