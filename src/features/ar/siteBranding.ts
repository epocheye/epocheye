/**
 * Per-site copy for the burned-in clip watermark.
 *
 * Hand-written, unlike `discoveryLayers.ts` which is generated — this is
 * editorial copy, not derived data.
 *
 * The era clause is a claim on a heritage monument and it is permanent once a
 * clip is posted, so it must be defensible. Note what it does NOT say:
 * "reconstructed 1791" would be wrong — the fort was rebuilt in stone in 1761
 * and stormed in 1791. What the model depicts is the fort AS IT STOOD on the
 * night of the storming, so that is what the caption claims.
 *
 * A site with no defensible date gets NO era clause. A placeholder year on a
 * heritage claim is worse than no year at all.
 */

interface SiteBranding {
  /** Falls back to the station title when absent. */
  title?: string;
  /** Short era clause, or undefined to omit it entirely. */
  era?: string;
}

const BRANDING: Record<string, SiteBranding> = {
  'bangalore-fort': {
    title: 'Bangalore Fort',
    era: 'as it stood in 1791',
  },
};

export function siteBrandingFor(slug?: string | null): SiteBranding {
  if (!slug) return {};
  return BRANDING[slug] ?? {};
}
