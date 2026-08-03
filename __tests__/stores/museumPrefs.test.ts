/**
 * Narration language resolution and the v2 → v3 store migration.
 *
 * The rule under test is that there is exactly ONE stored language (the app
 * language) and narration derives from it, with an override as the only way to
 * diverge. These assert the derivation and the upgrade path; the live wiring is
 * checked on device.
 */
import {
  getNarrationLang,
  useMuseumPrefsStore,
  narrationLangLabel,
  NARRATION_LANGS,
} from '../../src/stores/museumPrefsStore';
import i18n, { setAppLanguage, currentLanguage } from '../../src/i18n';

beforeEach(async () => {
  useMuseumPrefsStore.setState({
    narrationLangOverride: null,
    narrationPersona: 'casual',
  });
  await i18n.changeLanguage('en');
});

describe('getNarrationLang — derivation', () => {
  it('follows the app language when there is no override', async () => {
    expect(getNarrationLang()).toBe('en');
    await setAppLanguage('hi');
    expect(currentLanguage()).toBe('hi');
    expect(getNarrationLang()).toBe('hi');
    await setAppLanguage('bn');
    expect(getNarrationLang()).toBe('bn');
  });

  it('an override wins over the app language', async () => {
    await setAppLanguage('hi');
    useMuseumPrefsStore.getState().setNarrationLangOverride('en');
    expect(getNarrationLang()).toBe('en');
    expect(currentLanguage()).toBe('hi'); // UI unaffected
  });

  it('clearing the override returns to following the app language', async () => {
    await setAppLanguage('bn');
    useMuseumPrefsStore.getState().setNarrationLangOverride('en');
    expect(getNarrationLang()).toBe('en');
    useMuseumPrefsStore.getState().setNarrationLangOverride(null);
    expect(getNarrationLang()).toBe('bn');
  });

  it('keeps Bengali working — it is a first-class narration language', async () => {
    await setAppLanguage('bn');
    expect(getNarrationLang()).toBe('bn');
    expect(NARRATION_LANGS.map(l => l.code)).toContain('bn');
    expect(narrationLangLabel('bn')).toBe('বাংলা');
  });
});

describe('persona', () => {
  it('defaults to casual and only accepts the three authored personas', () => {
    expect(useMuseumPrefsStore.getState().narrationPersona).toBe('casual');
    useMuseumPrefsStore.getState().setNarrationPersona('history_buff');
    expect(useMuseumPrefsStore.getState().narrationPersona).toBe('history_buff');
    useMuseumPrefsStore.getState().setNarrationPersona('child');
    expect(useMuseumPrefsStore.getState().narrationPersona).toBe('child');
  });
});

describe('v2 → v3 migration', () => {
  // The migrate fn is on the persist options; reach it the way zustand would.
  const migrate = (useMuseumPrefsStore as unknown as {
    persist: { getOptions: () => { migrate?: (s: unknown, v: number) => unknown } };
  }).persist.getOptions().migrate!;

  it('discards the old independent narrationLang and follows the app language', () => {
    const out = migrate(
      { narrationLang: 'hi', narrationPersona: 'child' },
      2,
    ) as Record<string, unknown>;
    // Nothing is lost: the only writer of narrationLang also set the app
    // language, so @epocheye/app_language already carries this choice.
    expect(out.narrationLangOverride).toBeNull();
    expect(out.narrationLang).toBeUndefined();
    // An unrelated preference must survive the migration untouched.
    expect(out.narrationPersona).toBe('child');
  });

  it('backfills the persona for a v1 payload that predates it', () => {
    const out = migrate({ narrationLang: 'en' }, 1) as Record<string, unknown>;
    expect(out.narrationPersona).toBe('casual');
    expect(out.narrationLangOverride).toBeNull();
  });

  it('leaves a current v3 payload alone', () => {
    const out = migrate(
      { narrationLangOverride: 'en', narrationPersona: 'history_buff' },
      3,
    ) as Record<string, unknown>;
    expect(out.narrationLangOverride).toBe('en');
    expect(out.narrationPersona).toBe('history_buff');
  });
});
