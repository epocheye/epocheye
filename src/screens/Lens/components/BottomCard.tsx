import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScanSearch } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import type { Place } from '../../../utils/api/places';
import { FONTS } from '../../../core/constants/theme';

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
}

function formatPlaceSubline(place: Place): string {
  const year = (place as Place & { year?: string | number }).year;

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
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {state === 'searching' ? (
        <View style={styles.searchingRow}>
          <ActivityIndicator color="#E8A020" size="small" />
          <Text style={styles.searchingText}>Searching nearby...</Text>
        </View>
      ) : null}

      {state === 'matched' && place ? (
        <View>
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country} lens match`}
            style={styles.matchedVisual}
            imageStyle={styles.matchedVisual}
            loadingLabel="Loading monument visual..."
          />

          <Text style={styles.placeName}>{place.name}</Text>
          <Text style={styles.placeSubline}>{formatPlaceSubline(place)}</Text>
          <Text style={styles.ancestorLine}>Your ancestor was here.</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onOpenStory}
            >
              <Text style={styles.primaryButtonText}>Open Story</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onOpenInfo}
            >
              <Text style={styles.secondaryButtonText}>Monument Info</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.scanObjectButton}
            onPress={onScanObject}
          >
            <ScanSearch size={18} color="#E8A020" />
            <Text style={styles.scanObjectText}>Scan an object inside →</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {state === 'not_found' ? (
        <View>
          <Text style={styles.notFoundTitle}>
            {locationDenied
              ? 'Enable location to identify monuments near you.'
              : 'No heritage site detected nearby.'}
          </Text>
          <Text style={styles.notFoundBody}>
            Try moving closer, or search manually.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryButton} onPress={onBrowseMonuments}>
              <Text style={styles.primaryButtonText}>Browse Monuments</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={onSearchManually}
            >
              <Text style={styles.secondaryButtonText}>Search Manually</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(13,13,13,0.82)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#8C93A0',
    fontFamily: FONTS.regular,
  },
  matchedVisual: {
    width: '100%',
    height: 112,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#1A1A1A',
  },
  placeName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  placeSubline: {
    marginTop: 2,
    color: '#8C93A0',
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
  ancestorLine: {
    marginTop: 8,
    color: '#E8A020',
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: FONTS.italic,
  },
  buttonRow: {
    marginTop: 16,
    flexDirection: 'row',
    columnGap: 12,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8A020',
  },
  primaryButtonText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8A020',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#E8A020',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },
  scanObjectButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8A020',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  scanObjectText: {
    color: '#E8A020',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
  notFoundTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    fontFamily: FONTS.semiBold,
  },
  notFoundBody: {
    marginTop: 8,
    color: '#8C93A0',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: FONTS.regular,
  },
});

export default BottomCard;
