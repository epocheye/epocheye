/**
 * Era models for the AR experience shell.
 *
 * Each entry maps a moment in Konark's history to the GLB that represents
 * the temple at that time. `null` means the reconstruction does not exist
 * yet — the screen renders a calm "Reconstruction coming soon" state
 * instead of attempting to load.
 *
 * Future hookup: ArrivalBanner's "Open Lens" CTA will eventually navigate
 * to Ar3dViewerScreen with `{ monumentId: KONARK_SLUG, siteName: 'Konark
 * Sun Temple' }`. Today it points at the Lens scan flow — see plan #4.
 */

export const KONARK_SLUG = 'konark-sun-temple';
export const DEV_MONUMENT_ID = '__dev_test__';

export interface EraModel {
  year: number;
  label: string;
  // TODO: replace with per-era Konark GLB URLs (S3 / backend) once models exist.
  // Null = "Reconstruction coming soon" state; do NOT attempt to load.
  glbUrl: string | null;
}

export const KONARK_ERAS: EraModel[] = [
  {year: 1258, label: '1258 CE', glbUrl: null},
  {year: 1500, label: '1500 CE', glbUrl: null},
  {year: 1800, label: '1800 CE', glbUrl: null},
  {year: 2026, label: 'Today', glbUrl: null},
];
