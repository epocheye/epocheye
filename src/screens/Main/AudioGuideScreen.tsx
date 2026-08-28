/**
 * AudioGuideScreen — the venue's pre-generated narration, stop by stop.
 *
 * Fetches GET /api/v1/audio/stops for the active venue, lists the stops grouped
 * by zone, and plays the selected one through a SINGLE AudioPlayer instance that
 * is never unmounted between stops — tapping a new stop swaps the source on the
 * live player rather than remounting it, so the chosen playback speed carries
 * over and playback survives moving around the screen.
 *
 * The transcript below the player is the non-audio and accessibility path: every
 * clip's full text is available without listening.
 *
 * Language and persona both come from museumPrefsStore, shared with museum-mode
 * narration — one narration preference, not a second parallel one.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Headphones,
  Info,
  Play,
  Sparkles,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../../core/constants/theme';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { ROUTES } from '../../core/constants';
import { getAudioStops, AUDIO_PERSONAS } from '../../utils/api/audio';
import type { AudioStop, AudioStopsResponse } from '../../utils/api/audio';
import {
  useMuseumPrefsStore,
  useNarrationLang,
} from '../../stores/museumPrefsStore';
import { useSafeGoBack } from '../../shared/hooks/useSafeGoBack';
import { useNetwork } from '../../context/NetworkContext';
import OfflineInline from '../../components/ui/OfflineInline';
import AudioPlayer from '../../components/AudioPlayer';
import { buildAudioUrl } from '../../config/glbDelivery';
import {
  formatClipDuration,
  groupStopsByZone,
  hasRestoration,
  isPlayable,
  PERSONA_LABEL_KEY,
} from '../../shared/utils/audioGuide';

type Props = MainScreenProps<'AudioGuide'>;

const AudioGuideScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { venueSlug, siteName } = route.params;
  const goBack = useSafeGoBack();
  const { isOffline } = useNetwork();

  // Derived from the app language unless the user overrode it in Settings.
  const lang = useNarrationLang();
  const persona = useMuseumPrefsStore(s => s.narrationPersona);
  const setPersona = useMuseumPrefsStore(s => s.setNarrationPersona);

  const [data, setData] = useState<AudioStopsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The selected stop is held by KEY, not by object: a refetch (persona or
  // language change) replaces every stop object, and holding the key lets the
  // selection survive it when the same stop exists in the new payload.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getAudioStops(venueSlug, lang, persona);
    if (result.success) {
      setData(result.data);
    } else {
      setData(null);
      setError(result.error.message);
    }
    setLoading(false);
  }, [venueSlug, lang, persona]);

  useEffect(() => {
    void load();
  }, [load]);

  // Memoised so the `?? []` fallback doesn't hand a fresh array to the memos
  // below on every render, which would re-group and re-scan the list each time.
  const stops = useMemo(() => data?.stops ?? [], [data]);
  const groups = useMemo(() => groupStopsByZone(stops), [stops]);

  const selected: AudioStop | null = useMemo(
    () => stops.find(s => s.stop_key === selectedKey) ?? null,
    [stops, selectedKey],
  );

  // Resolve the CDN key (or absolute URL) the backend returned into something
  // playable. Null when unresolvable — e.g. a relative key with no AUDIO_BASE_URL.
  const selectedUri = useMemo(
    () => (selected?.clip ? buildAudioUrl(selected.clip.audio_url) : null),
    [selected],
  );

  // The restoration image uses the same key-or-absolute-URL convention as the
  // audio, so it resolves through the same helper.
  const restorationUri = useMemo(
    () =>
      selected?.restoration_image_url
        ? buildAudioUrl(selected.restoration_image_url)
        : null,
    [selected],
  );

  const handleSelect = useCallback((stop: AudioStop) => {
    if (!isPlayable(stop)) return;
    setSelectedKey(stop.stop_key);
  }, []);

  const renderBody = () => {
    if (isOffline && !data) {
      return <OfflineInline message={t('offline.inlineMessage')} />;
    }
    if (loading && !data) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.gold} />
        </View>
      );
    }
    if (error && !data) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyBody}>{t('audioGuide.loadError')}</Text>
          <Pressable onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
          </Pressable>
        </View>
      );
    }
    if (stops.length === 0) {
      return (
        <View style={styles.centered}>
          <Headphones size={26} color={COLORS.textTertiary} />
          <Text style={styles.emptyTitle}>{t('audioGuide.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('audioGuide.emptyBody')}</Text>
        </View>
      );
    }

    return (
      <>
        {data?.fallback_lang ? (
          <View style={styles.notice}>
            <Info size={14} color={COLORS.textSecondary} />
            <Text style={styles.noticeText}>
              {t('audioGuide.fallbackNotice')}
            </Text>
          </View>
        ) : null}

        {groups.map(group => (
          <View key={group.zone ?? '__ungrouped__'} style={styles.group}>
            {group.zone ? (
              <Text style={styles.zoneHeader}>{group.zone.toUpperCase()}</Text>
            ) : null}
            {group.stops.map(stop => {
              const playable = isPlayable(stop);
              const active = stop.stop_key === selectedKey;
              return (
                <Pressable
                  key={stop.stop_key}
                  onPress={() => handleSelect(stop)}
                  disabled={!playable}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !playable, selected: active }}
                  accessibilityLabel={stop.title}
                  style={[styles.row, active && styles.rowActive]}>
                  <Play
                    size={14}
                    color={playable ? COLORS.gold : COLORS.textTertiary}
                    fill={active ? COLORS.gold : 'transparent'}
                  />
                  <Text
                    style={[styles.rowTitle, !playable && styles.rowDisabled]}
                    numberOfLines={2}>
                    {stop.title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {playable
                      ? formatClipDuration(stop.clip?.duration_ms)
                      : t('audioGuide.notRecorded')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        {selected?.clip && selectedUri ? (
          <View style={styles.playerBlock}>
            {/* One instance, no `key` prop: changing `uri` swaps the source on
                the SAME player rather than remounting it, which is what keeps
                the chosen speed and avoids a playback gap between stops. */}
            <AudioPlayer
              uri={selectedUri}
              sourceKey={selected.stop_key}
              title={selected.title}
              autoPlay
            />

            {/* Only for stops that actually have a restored view — the other
                stops are unchanged. */}
            {hasRestoration(selected) && restorationUri ? (
              <Pressable
                onPress={() =>
                  navigation.navigate(ROUTES.MAIN.RESTORATION, {
                    imageUrl: restorationUri,
                    caption: selected.clip?.restoration_caption,
                    title: selected.title,
                    siteName,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('restoration.cta')}
                style={styles.restorationBtn}>
                <Sparkles size={16} color={COLORS.gold} />
                <Text style={styles.restorationText}>
                  {t('restoration.cta')}
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.transcriptTitle}>
              {t('audioGuide.transcriptTitle')}
            </Text>
            <Text style={styles.transcript}>{selected.clip.transcript}</Text>
          </View>
        ) : null}
      </>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={styles.backBtn}>
            <ChevronLeft size={20} color={COLORS.textPrimary} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {t('audioGuide.title')}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {siteName || t('audioGuide.subtitle')}
            </Text>
          </View>
        </View>

        <View
          style={styles.personaRow}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('audioGuide.personaLabel')}>
          {AUDIO_PERSONAS.map(p => {
            const active = p === persona;
            return (
              <Pressable
                key={p}
                onPress={() => setPersona(p)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.personaChip, active && styles.personaChipActive]}>
                <Text
                  style={[
                    styles.personaText,
                    active && styles.personaTextActive,
                  ]}
                  numberOfLines={1}>
                  {t(PERSONA_LABEL_KEY[p])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {renderBody()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  personaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  personaChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
    backgroundColor: COLORS.bgWarm,
    alignItems: 'center',
  },
  personaChipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  personaText: {
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textSecondary,
  },
  personaTextActive: { color: COLORS.bg },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.section,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.section,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.subtitle,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  emptyBody: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
  },
  retryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
    backgroundColor: COLORS.bgWarm,
  },
  noticeText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textSecondary,
  },
  group: { marginBottom: SPACING.lg },
  zoneHeader: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 1.6,
    color: COLORS.textTertiary,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowActive: {
    borderColor: COLORS.amberSubtle,
    backgroundColor: COLORS.bgWarm,
  },
  rowTitle: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: FONT_SIZES.body,
    color: COLORS.textPrimary,
  },
  rowDisabled: { color: COLORS.textTertiary },
  rowMeta: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: COLORS.textTertiary,
  },
  playerBlock: { marginTop: SPACING.md },
  restorationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
    backgroundColor: COLORS.bgWarm,
  },
  restorationText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.gold,
  },
  transcriptTitle: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 1.6,
    color: COLORS.textTertiary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  transcript: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.body,
    lineHeight: FONT_SIZES.body * 1.6,
    color: COLORS.textSecondary,
  },
});

export default AudioGuideScreen;
