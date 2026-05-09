/**
 * NearbyAnchorsList
 *
 * Horizontal pill list rendered at the bottom of the AR lens. Each pill
 * shows a curated asset + the distance from the user to its closest
 * placement, e.g. "→ Sun Wheel · 14m". Tap → caller decides (typically
 * shortcut into the AR composer with that GLB).
 *
 * Data sources:
 *   - `getActiveSiteBundle()` — synchronous read from sitePrefetchService;
 *     filled on geofence entry by siteDetectionService.checkZoneEntry.
 *   - currentLocation prop — caller passes the user's live GPS so we can
 *     compute haversine distance per render.
 *
 * Filters: placements within 50m, sorted by distance, capped at 5. An
 * asset is shown once even if it has multiple placements (closest wins).
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';

import { getActiveSiteBundle } from '../../../services/sitePrefetchService';
import type {
  SiteBundleAsset,
  SiteBundlePlacement,
} from '../../../utils/api/ar';

interface NearbyEntry {
  asset: SiteBundleAsset;
  placement: SiteBundlePlacement;
  distance: number;
}

interface Props {
  monumentId: string;
  currentLat: number | null;
  currentLng: number | null;
  onSelect: (asset: SiteBundleAsset, placement: SiteBundlePlacement) => void;
}

const MAX_PILLS = 5;
const MAX_DISTANCE_METERS = 50;

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NearbyAnchorsList: React.FC<Props> = ({
  monumentId,
  currentLat,
  currentLng,
  onSelect,
}) => {
  const entries = useMemo<NearbyEntry[]>(() => {
    if (currentLat == null || currentLng == null) return [];
    const bundle = getActiveSiteBundle();
    if (!bundle || bundle.monument_id !== monumentId) return [];
    const assets = bundle.assets ?? [];
    if (assets.length === 0) return [];

    const list: NearbyEntry[] = [];
    for (const asset of assets) {
      let closest: { placement: SiteBundlePlacement; distance: number } | null =
        null;
      for (const placement of asset.placements) {
        if (placement.lat == null || placement.lng == null) continue;
        const d = haversineMeters(
          currentLat,
          currentLng,
          placement.lat,
          placement.lng,
        );
        if (d > MAX_DISTANCE_METERS) continue;
        if (!closest || d < closest.distance) {
          closest = { placement, distance: d };
        }
      }
      if (closest) {
        list.push({ asset, placement: closest.placement, distance: closest.distance });
      }
    }

    list.sort((a, b) => a.distance - b.distance);
    return list.slice(0, MAX_PILLS);
  }, [monumentId, currentLat, currentLng]);

  if (entries.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      {entries.map(({ asset, placement, distance }) => (
        <TouchableOpacity
          key={`${asset.asset_id}:${placement.id}`}
          style={styles.pill}
          onPress={() => onSelect(asset, placement)}
          accessibilityRole="button"
          accessibilityLabel={`${asset.object_label}, ${Math.round(distance)} meters away`}
        >
          <ArrowUpRight color="#E8A020" size={12} />
          <Text style={styles.label} numberOfLines={1}>
            {asset.object_label}
          </Text>
          <View style={styles.dot} />
          <Text style={styles.distance}>{Math.round(distance)}m</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 44,
  },
  row: {
    paddingHorizontal: 16,
    columnGap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.35)',
    maxWidth: 200,
  },
  label: {
    color: '#F5F0E8',
    fontFamily: 'MontserratAlternates-SemiBold',
    fontSize: 12,
    flexShrink: 1,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(245,240,232,0.4)',
  },
  distance: {
    color: '#E8A020',
    fontFamily: 'MontserratAlternates-Medium',
    fontSize: 11,
  },
});

export default NearbyAnchorsList;
