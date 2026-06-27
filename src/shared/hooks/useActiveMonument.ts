/**
 * useActiveMonument — single source of truth for "what monument is the
 * user engaging with right now?" Every post-auth screen reads from here
 * rather than hardcoding a slug.
 *
 * Resolution order (see src/config/monuments.ts for the contract):
 *   1. opts.explicitSlug
 *   2. useCurrentZoneStore().zone.monument_id
 *   3. Nearest curated site to usePlacesStore().currentLocation (no distance cap —
 *      always the true nearest, even if far)
 *   4. DEFAULT_MONUMENT_SLUG (only when there's no location or zero curated sites)
 *
 * Module-level in-memory caches:
 *   - siteCache: slug -> SiteDetail (survives screen unmounts)
 *   - sitesListCache: 5-minute TTL for the catalogue
 *
 * Loading semantics: every derived helper safely no-ops while the
 * resolved site is in flight, so consumers can render unconditionally
 * on `title`, `heroSource`, `isAtSite`, `hasAccess`, `eras`.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ImageSourcePropType} from 'react-native';

import {getSite, getSites, type SiteDetail} from '../../utils/api/places';
import {useCurrentZoneStore} from '../../stores/currentZoneStore';
import {usePlacesStore} from '../../stores/placesStore';
import {resolveSiteImageSource} from '../utils/localSiteImages';
import {useExplorerPass} from './useExplorerPass';
import {DEFAULT_MONUMENT_SLUG} from '../../config/monuments';
import {
  parseSiteEras,
  type SiteEraConfig,
} from '../../screens/Main/components/eraModels';

const siteCache = new Map<string, SiteDetail>();
const inflightSiteFetches = new Map<string, Promise<SiteDetail | null>>();

let sitesListCache: {data: SiteDetail[]; fetchedAt: number} | null = null;
let inflightSitesListFetch: Promise<SiteDetail[]> | null = null;
const SITES_LIST_TTL_MS = 5 * 60 * 1000;

export type ActiveMonumentStatus = 'loading' | 'ready' | 'none' | 'error';
export type ActiveMonumentSource = 'explicit' | 'zone' | 'nearest' | 'default';

export interface ActiveMonument {
  status: ActiveMonumentStatus;
  slug: string | null;
  site: SiteDetail | null;
  source: ActiveMonumentSource | null;
  title: string;
  heroSource: ImageSourcePropType | null;
  isAtSite: boolean;
  hasAccess: boolean;
  eras: SiteEraConfig | null;
  refresh: () => Promise<void>;
}

export interface UseActiveMonumentOpts {
  explicitSlug?: string | null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchSiteCached(slug: string): Promise<SiteDetail | null> {
  const cached = siteCache.get(slug);
  if (cached) return cached;
  const inflight = inflightSiteFetches.get(slug);
  if (inflight) return inflight;

  const promise = (async () => {
    const result = await getSite(slug);
    if (result.success) {
      siteCache.set(slug, result.data);
      return result.data;
    }
    return null;
  })().finally(() => {
    inflightSiteFetches.delete(slug);
  });
  inflightSiteFetches.set(slug, promise);
  return promise;
}

async function fetchSitesListCached(): Promise<SiteDetail[]> {
  const now = Date.now();
  if (sitesListCache && now - sitesListCache.fetchedAt < SITES_LIST_TTL_MS) {
    return sitesListCache.data;
  }
  if (inflightSitesListFetch) return inflightSitesListFetch;

  const promise = (async () => {
    const result = await getSites();
    const data = result.success ? result.data : [];
    sitesListCache = {data, fetchedAt: Date.now()};
    return data;
  })().finally(() => {
    inflightSitesListFetch = null;
  });
  inflightSitesListFetch = promise;
  return promise;
}

function findNearestSite(
  sites: SiteDetail[],
  lat: number,
  lon: number,
): SiteDetail | null {
  let nearest: SiteDetail | null = null;
  let minKm = Infinity;
  for (const s of sites) {
    if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') {
      continue;
    }
    const d = haversineKm(lat, lon, s.latitude, s.longitude);
    if (d < minKm) {
      minKm = d;
      nearest = s;
    }
  }
  // Return the TRUE nearest curated site regardless of distance — even if it's
  // hundreds of km away the user should be pointed at it (no radius cap, no
  // hardcoded default). This matches Home's getNearestZone() nudge so the two
  // no longer disagree (e.g. "Indian Museum" vs the old "Konark 616 km" default).
  return nearest;
}

interface ResolvedState {
  slug: string | null;
  source: ActiveMonumentSource | null;
  site: SiteDetail | null;
  status: ActiveMonumentStatus;
}

const INITIAL_STATE: ResolvedState = {
  slug: null,
  source: null,
  site: null,
  status: 'loading',
};

export function useActiveMonument(
  opts?: UseActiveMonumentOpts,
): ActiveMonument {
  const explicitSlug = opts?.explicitSlug?.trim() || null;
  const zoneMonumentId = useCurrentZoneStore(
    s => s.zone?.monument_id ?? null,
  );
  const currentLocation = usePlacesStore(s => s.currentLocation);
  const {passes} = useExplorerPass();

  const [state, setState] = useState<ResolvedState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    function applyResolved(
      slug: string,
      source: ActiveMonumentSource,
      site: SiteDetail | null,
    ): void {
      if (cancelled) return;
      setState({slug, source, site, status: site ? 'ready' : 'error'});
    }

    async function resolveSlug(
      slug: string,
      source: ActiveMonumentSource,
    ): Promise<void> {
      const cached = siteCache.get(slug);
      if (cached) {
        applyResolved(slug, source, cached);
        return;
      }
      // Flip to loading only when we don't already have the same slug ready.
      const prev = stateRef.current;
      if (prev.slug !== slug || prev.source !== source || prev.status !== 'loading') {
        setState({slug, source, site: null, status: 'loading'});
      }
      const site = await fetchSiteCached(slug);
      applyResolved(slug, source, site);
    }

    async function run(): Promise<void> {
      if (explicitSlug) {
        await resolveSlug(explicitSlug, 'explicit');
        return;
      }
      if (zoneMonumentId) {
        await resolveSlug(zoneMonumentId, 'zone');
        return;
      }
      if (currentLocation) {
        const sites = await fetchSitesListCached();
        if (cancelled) return;
        const nearest = findNearestSite(
          sites,
          currentLocation.latitude,
          currentLocation.longitude,
        );
        if (nearest) {
          const slug = nearest.slug ?? nearest.id;
          siteCache.set(slug, nearest);
          applyResolved(slug, 'nearest', nearest);
          return;
        }
      }
      await resolveSlug(DEFAULT_MONUMENT_SLUG, 'default');
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [explicitSlug, zoneMonumentId, currentLocation]);

  const refresh = useCallback(async () => {
    const slug = stateRef.current.slug;
    if (!slug) return;
    siteCache.delete(slug);
    const site = await fetchSiteCached(slug);
    setState(prev => ({...prev, site, status: site ? 'ready' : 'error'}));
  }, []);

  return useMemo<ActiveMonument>(() => {
    const {slug, site, source, status} = state;
    const effectiveStatus: ActiveMonumentStatus =
      slug == null ? 'none' : status;
    const title = site?.name ?? '';
    const heroSource = site ? resolveSiteImageSource(site) : null;
    const isAtSite = slug != null && zoneMonumentId === slug;
    const hasAccess =
      slug != null &&
      passes.some(p => p.is_active && p.place_ids.includes(slug));
    const eras = parseSiteEras(site);
    return {
      status: effectiveStatus,
      slug,
      site,
      source,
      title,
      heroSource,
      isAtSite,
      hasAccess,
      eras,
      refresh,
    };
  }, [state, zoneMonumentId, passes, refresh]);
}
