/**
 * Audio-guide clip URL resolution (src/config/glbDelivery.ts).
 *
 * The backend's audio_clips.audio_url may hold either a CDN key or a fully
 * qualified URL, so buildAudioUrl has to handle both. `@env` is the static test
 * mock (no AUDIO_BASE_URL), which is deliberately useful here: it proves an
 * absolute audio_url still resolves with NO CDN base configured, while a
 * relative key correctly yields null.
 */
import {
  buildAudioUrl,
  joinAudioUrl,
  isRemoteAudioConfigured,
} from '../../src/config/glbDelivery';
import { AUDIO_BASE_URL } from '@env';

describe('joinAudioUrl', () => {
  it('joins a CDN key onto the base, extension untouched', () => {
    expect(
      joinAudioUrl('https://d123.cloudfront.net', 'audio/konark/walls_en.m4a'),
    ).toBe('https://d123.cloudfront.net/audio/konark/walls_en.m4a');
    // Containers vary — nothing is appended or rewritten.
    expect(joinAudioUrl('https://cdn', 'audio/a.mp3')).toBe(
      'https://cdn/audio/a.mp3',
    );
  });

  it('passes an absolute http(s) url straight through, ignoring the base', () => {
    expect(
      joinAudioUrl('https://cdn.example.com', 'https://other.host/clip.m4a'),
    ).toBe('https://other.host/clip.m4a');
    expect(joinAudioUrl('', 'http://other.host/clip.m4a')).toBe(
      'http://other.host/clip.m4a',
    );
    expect(joinAudioUrl(undefined, 'HTTPS://Other.Host/clip.m4a')).toBe(
      'HTTPS://Other.Host/clip.m4a',
    );
  });

  it('normalises slashes between base and key', () => {
    expect(joinAudioUrl('https://cdn/', 'audio/a.m4a')).toBe(
      'https://cdn/audio/a.m4a',
    );
    expect(joinAudioUrl('https://cdn///', '/audio/a.m4a')).toBe(
      'https://cdn/audio/a.m4a',
    );
  });

  it('returns null for a relative key when no base is configured', () => {
    expect(joinAudioUrl('', 'audio/a.m4a')).toBeNull();
    expect(joinAudioUrl('   ', 'audio/a.m4a')).toBeNull();
    expect(joinAudioUrl(undefined, 'audio/a.m4a')).toBeNull();
  });

  it('returns null for an empty audio_url', () => {
    expect(joinAudioUrl('https://cdn', '')).toBeNull();
    expect(joinAudioUrl('https://cdn', '   ')).toBeNull();
    expect(joinAudioUrl('https://cdn', '/')).toBeNull();
  });
});

describe('buildAudioUrl (delegates to joinAudioUrl with the configured base)', () => {
  it('matches joinAudioUrl(AUDIO_BASE_URL, url)', () => {
    expect(buildAudioUrl('audio/konark/walls_en.m4a')).toBe(
      joinAudioUrl(AUDIO_BASE_URL, 'audio/konark/walls_en.m4a'),
    );
  });

  it('resolves an absolute clip url even with no CDN base configured', () => {
    expect(buildAudioUrl('https://other.host/clip.m4a')).toBe(
      'https://other.host/clip.m4a',
    );
  });

  it('isRemoteAudioConfigured reflects whether a base is set', () => {
    expect(isRemoteAudioConfigured()).toBe(
      !!AUDIO_BASE_URL && AUDIO_BASE_URL.trim().length > 0,
    );
  });
});
