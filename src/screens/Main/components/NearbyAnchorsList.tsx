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
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
// ~5.5m grid (0.00005° ≈ 5.5m at the equator) — gates re-computation to real movement.
const GPS_GRID_DEG = 0.00005;

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
  // Snap the live GPS to a ~5m grid so the (assets × placements) distance pass and
  // the resulting list only recompute when the user actually moves — not on every
  // minor GPS update/jitter, which would otherwise churn this list on each tick.
  const gridLat =
    currentLat == null ? null : Math.round(currentLat / GPS_GRID_DEG) * GPS_GRID_DEG;
  const gridLng =
    currentLng == null ? null : Math.round(currentLng / GPS_GRID_DEG) * GPS_GRID_DEG;

  const entries = useMemo<NearbyEntry[]>(() => {
    if (gridLat == null || gridLng == null) return [];
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
          gridLat,
          gridLng,
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
  }, [monumentId, gridLat, gridLng]);

  if (entries.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{paddingHorizontal: 16, columnGap: 8, alignItems: 'center'}}
      className="max-h-[44px]"
    >
      {entries.map(({ asset, placement, distance }) => (
        <TouchableOpacity
          key={`${asset.asset_id}:${placement.id}`}
          className="flex-row items-center gap-x-[6px] px-3 py-2 rounded-full bg-[rgba(13,13,13,0.92)] border border-[rgba(203,168,98,0.35)] max-w-[200px]"
          onPress={() => onSelect(asset, placement)}
          accessibilityRole="button"
          accessibilityLabel={`${asset.object_label}, ${Math.round(distance)} meters away`}
        >
          <ArrowUpRight color="#CBA862" size={12} />
          <Text className="text-parchment font-ui-semibold text-[12px] shrink" numberOfLines={1}>
            {asset.object_label}
          </Text>
          <View className="w-[3px] h-[3px] rounded-[2px] bg-[rgba(245,240,232,0.4)]" />
          <Text className="text-accent-amber font-ui-medium text-[11px]">
            {Math.round(distance)}m
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

export default NearbyAnchorsList;
