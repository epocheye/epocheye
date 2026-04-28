/**
 * Build the anchor list that the native Geospatial AR view consumes.
 *
 * Steps:
 *   1. Filter the site bundle for objects that have a usable anchor (geospatial
 *      mode with non-null lat/lng).
 *   2. Pre-cache each GLB through the on-device cache so the native side
 *      receives a `file://` URI whenever possible — SceneView's modelLoader
 *      handles local files most reliably.
 *   3. Return the prepared list ready for the `<EpocheyeGeospatialARView />`
 *      `anchors` prop.
 */
import { getOrFetchGlb } from './glbCache';
import type { SiteBundleObject } from '../utils/api/ar';
import type { PreparedGeoAnchor } from '../native/EpocheyeGeospatialARView';

export async function prepareGeospatialAnchors(
  objects: SiteBundleObject[],
): Promise<PreparedGeoAnchor[]> {
  const eligible = objects.filter(
    o =>
      o.anchor_mode === 'geospatial' &&
      o.lat != null &&
      o.lng != null &&
      o.glb_url,
  );

  // Run downloads in parallel; failures degrade to remote URL so the native
  // side can still attempt to load over network.
  const prepared = await Promise.all(
    eligible.map(async o => {
      const localOrRemote = await getOrFetchGlb(o.glb_url);
      const anchor: PreparedGeoAnchor = {
        label: o.object_label,
        glb_uri: localOrRemote,
        lat: o.lat as number,
        lng: o.lng as number,
      };
      if (o.altitude != null) anchor.altitude = o.altitude;
      if (o.heading_deg != null) anchor.heading_deg = o.heading_deg;
      return anchor;
    }),
  );

  return prepared;
}

/**
 * Returns true when a site bundle contains anchors usable in geospatial mode.
 * If false, the caller should swap to the 2D compass-relative fallback UI.
 */
export function hasGeospatialAnchors(objects: SiteBundleObject[]): boolean {
  return objects.some(
    o => o.anchor_mode === 'geospatial' && o.lat != null && o.lng != null,
  );
}
