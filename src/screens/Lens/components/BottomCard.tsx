import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Layers, ScanSearch, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResolvedSubjectImage from '../../../components/ui/ResolvedSubjectImage';
import type { Place } from '../../../utils/api/places';
import { FONTS } from '../../../core/constants/theme';
import { getPlaceImage } from '../../../shared/utils';

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
  onIdentify,
  identifyLoading,
  remainingCalls,
  onHDScan,
  hdScanLoading,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      {state === 'searching' ? (
        <View style={styles.searchingRow}>
          <ActivityIndicator color="#E8A020" size="small" />
          <Text style={styles.searchingText}>Looking for heritage sites near you...</Text>
        </View>
      ) : null}

      {state === 'matched' && place ? (
        <View>
          <ResolvedSubjectImage
            subject={place.name}
            context={`${place.city} ${place.country} lens match`}
            fallbackUri={getPlaceImage(place.categories)}
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

          {onIdentify && (
            <TouchableOpacity
              style={styles.identifyButton}
              onPress={onIdentify}
              disabled={identifyLoading}
            >
              {identifyLoading ? (
                <ActivityIndicator color="#0D0D0D" size="small" />
              ) : (
                <>
                  <Sparkles size={18} color="#0D0D0D" />
                  <Text style={styles.identifyButtonText}>
                    Identify Heritage
                  </Text>
                </>
              )}
              {remainingCalls !== undefined &&
                remainingCalls !== Infinity &&
                !identifyLoading && (
                  <Text style={styles.remainingText}>
                    {remainingCalls} left
                  </Text>
                )}
            </TouchableOpacity>
          )}

          {onHDScan && (
            <TouchableOpacity
              style={styles.hdScanButton}
              onPress={onHDScan}
              disabled={hdScanLoading}
            >
              {hdScanLoading ? (
                <ActivityIndicator color="#E8A020" size="small" />
              ) : (
                <>
                  <Layers size={16} color="#E8A020" />
                  <Text style={styles.hdScanButtonText}>HD Scan</Text>
                  <View style={styles.hdBadge}>
                    <Text style={styles.hdBadgeText}>PRO</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {state === 'not_found' ? (
        <View>
          <Text style={styles.notFoundTitle}>
            {locationDenied
              ? 'Turn on location to discover heritage sites near you'
              : 'No heritage sites found nearby'}
          </Text>
          <Text style={styles.notFoundBody}>
            Try visiting a heritage site, or search for one below
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
  identifyButton: {
    marginTop: 10,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E8A020',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  identifyButtonText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  remainingText: {
    color: 'rgba(13,13,13,0.6)',
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginLeft: 4,
  },
  hdScanButton: {
    marginTop: 8,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(232,160,32,0.5)',
    backgroundColor: 'rgba(232,160,32,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  hdScanButtonText: {
    color: '#E8A020',
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  hdBadge: {
    backgroundColor: '#E8A020',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hdBadgeText: {
    color: '#0D0D0D',
    fontSize: 9,
    fontFamily: FONTS.bold,
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
