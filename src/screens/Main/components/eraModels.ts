/**
 * Era models for the AR experience shell.
 *
 * Era data lives in the backend `monuments.content.ar_data` jsonb column
 * — already returned by `GET /api/v1/sites/{slug}` as `site.content`.
 * This module defines the normalised shape consumed by `Ar3dViewerScreen`
 * and a parser that reads the jsonb into that shape.
 *
 * The parser accepts two array keys for forward-compat:
 *   - `ar_data.era_reconstructions` (preferred — Konark-style)
 *   - `ar_data.era_overlays`         (Victoria-style)
 *
 * Each item is validated for `{ year: number, label: string }`. The
 * backend `glb_url` (snake_case) is normalised to `glbUrl` and may be
 * null — `Ar3dViewerScreen` renders the "Reconstruction coming soon"
 * empty state when null.
 *
 * Returns null when the site has no parseable era data; the viewer
 * then shows the same empty state. Adding eras for a monument is a
 * pure jsonb authoring operation — no code change.
 */

import type {SiteDetail} from '../../../utils/api/places';

/** Dev-only marker for the test-pipeline button. Unrelated to real data. */
export const DEV_MONUMENT_ID = '__dev_test__';

export interface EraModel {
  year: number;
  label: string;
  glbUrl: string | null;
}

export interface SiteEraConfig {
  eras: EraModel[];
  defaultIndex: number;
}

interface RawEra {
  year?: unknown;
  label?: unknown;
  glb_url?: unknown;
  glbUrl?: unknown;
}

interface RawArData {
  era_reconstructions?: unknown;
  era_overlays?: unknown;
  default_era_index?: unknown;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseEraItem(raw: unknown): EraModel | null {
  if (!isObject(raw)) return null;
  const r = raw as RawEra;
  if (typeof r.year !== 'number' || !Number.isFinite(r.year)) return null;
  if (typeof r.label !== 'string' || r.label.length === 0) return null;
  const url =
    typeof r.glb_url === 'string' && r.glb_url.length > 0
      ? r.glb_url
      : typeof r.glbUrl === 'string' && r.glbUrl.length > 0
      ? r.glbUrl
      : null;
  return {year: r.year, label: r.label, glbUrl: url};
}

export function parseSiteEras(site: SiteDetail | null): SiteEraConfig | null {
  if (!site || !isObject(site.content)) return null;
  const arData = (site.content as Record<string, unknown>).ar_data;
  if (!isObject(arData)) return null;
  const raw = arData as RawArData;

  const arr = Array.isArray(raw.era_reconstructions)
    ? raw.era_reconstructions
    : Array.isArray(raw.era_overlays)
    ? raw.era_overlays
    : null;
  if (!arr || arr.length === 0) return null;

  const eras: EraModel[] = [];
  for (const item of arr) {
    const parsed = parseEraItem(item);
    if (parsed) {
      eras.push(parsed);
    } else if (__DEV__) {
      console.warn('[eraModels] skipped malformed era entry', item);
    }
  }
  if (eras.length === 0) return null;

  eras.sort((a, b) => a.year - b.year);

  let defaultIndex = 0;
  if (typeof raw.default_era_index === 'number') {
    const v = Math.floor(raw.default_era_index);
    if (Number.isFinite(v) && v >= 0 && v < eras.length) {
      defaultIndex = v;
    }
  }

  return {eras, defaultIndex};
}
