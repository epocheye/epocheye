/**
 * Config-driven GLB URL building. Confirms the {GLB_BASE_URL}/{modelId}.glb
 * contract and that an empty base yields null (→ caller uses the bundled
 * fallback). `@env` is the static test mock (no GLB_BASE_URL), so buildGlbUrl
 * exercises the unset path; the "set" path is covered via the pure joinGlbUrl.
 */
import { buildGlbUrl, joinGlbUrl } from '../../src/config/glbDelivery';
import { GLB_BASE_URL } from '@env';

describe('joinGlbUrl', () => {
  it('builds {base}/{id}.glb', () => {
    expect(joinGlbUrl('https://d123.cloudfront.net', 'konark_vimana')).toBe(
      'https://d123.cloudfront.net/konark_vimana.glb',
    );
  });

  it('trims trailing slashes on the base', () => {
    expect(joinGlbUrl('https://cdn.example.com/', 'foo')).toBe(
      'https://cdn.example.com/foo.glb',
    );
    expect(joinGlbUrl('https://cdn.example.com///', 'foo')).toBe(
      'https://cdn.example.com/foo.glb',
    );
  });

  it('accepts an id that already ends in .glb or has a leading slash', () => {
    expect(joinGlbUrl('https://cdn', 'foo.glb')).toBe('https://cdn/foo.glb');
    expect(joinGlbUrl('https://cdn', '/foo')).toBe('https://cdn/foo.glb');
  });

  it('returns null for an empty/whitespace base', () => {
    expect(joinGlbUrl('', 'foo')).toBeNull();
    expect(joinGlbUrl('   ', 'foo')).toBeNull();
    expect(joinGlbUrl(undefined, 'foo')).toBeNull();
  });

  it('returns null for an empty id', () => {
    expect(joinGlbUrl('https://cdn', '')).toBeNull();
    expect(joinGlbUrl('https://cdn', '.glb')).toBeNull();
  });
});

describe('buildGlbUrl (delegates to joinGlbUrl with the configured base)', () => {
  // Env-agnostic: when a CDN base is configured (.env GLB_BASE_URL) buildGlbUrl
  // returns the joined URL; when it's empty it returns null so the resolver
  // falls back to the bundled GLB. Either way it must equal the pure join.
  it('matches joinGlbUrl(GLB_BASE_URL, id)', () => {
    expect(buildGlbUrl('konark_vimana')).toBe(
      joinGlbUrl(GLB_BASE_URL, 'konark_vimana'),
    );
  });
});
