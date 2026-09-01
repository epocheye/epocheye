/**
 * AudioGuideScreen — the stop you are standing at, and how to hear it.
 *
 * WHAT THIS REPLACED, AND WHY. The first version was a catalogue: title,
 * subtitle, three persona chips, four zone headings, eight stop rows each with
 * a duration — twenty-five text elements and twelve controls, with NOTHING
 * PLAYING. Choosing a stop then mounted the player BELOW all eight rows, so the
 * act of picking something to listen to pushed the play button toward the fold.
 * The screen's resting state was an index of things the visitor was not
 * hearing.
 *
 * The guide is used walking around a building, often with the phone held low or
 * not looked at. So the current stop IS the screen: where you are, what to
 * listen for, one large play control, and how much is left. The other seven
 * stops, the transcript, the persona, the speed and the restored view are all
 * one tap away in the sheet. Nothing was deleted — see components/ui/DetailSheet.
 *
 * WHERE TO STAND COSTS NOTHING. `walkToForStop` joins an audio stop to the
 * guided tour's authored walk-to prose through the magic window's viewpoints
 * (stop_key -> viewpoint -> tour stop). It is 1:1 for the palace and absent
 * everywhere else, and absent is left absent: an invented direction is worse
 * than none on a screen whose whole job is telling someone where to go.
 *
 * ONE PLAYER, INSIDE THE SHEET. Same arrangement as the magic window. The sheet
 * is never unmounted, so the full transport (scrub, speed, skip 15 s) lives
 * there while the screen keeps only play/pause — the one control a visitor
 * needs without looking. `suspended` is what the big button drives, because
 * there is no imperative handle on <AudioPlayer/> and `suspended` holds
 * playback WITHOUT losing the position.
 *
 * Language and persona both come from museumPrefsStore, shared with museum-mode
 * narration — one narration preference, not a second parallel one.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Headphones,
  Info,
  List,
  Pause,
  Play,
  SkipBack,
  SkipForward,
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
import { getAudioStops } from '../../utils/api/audio';
import type { AudioStop, AudioStopsResponse } from '../../utils/api/audio';
import {
  useMuseumPrefsStore,
  useNarrationLang,
} from '../../stores/museumPrefsStore';
import { useSafeGoBack } from '../../shared/hooks/useSafeGoBack';
import { useNetwork } from '../../context/NetworkContext';
import OfflineInline from '../../components/ui/OfflineInline';
import AudioGuideSheet from '../../features/audioguide/AudioGuideSheet';
import AudioPlayer from '../../components/AudioPlayer';
import { buildAudioUrl } from '../../config/glbDelivery';
import { walkToForStop } from '../../features/magicwindow/tour';
import {
  formatClipDuration,
  formatZoneLabel,
  groupStopsByZone,
  isPlayable,
} from '../../shared/utils/audioGuide';

type Props = MainScreenProps<'AudioGuide'>;

/**
 * How long the guide waits before playing the next stop.
 *
 * Long enough to notice that it is about to happen and say no — the whole
 * reason the gap exists — and short enough that a visitor walking between two
 * stops is not left standing in silence wondering whether it broke. The offer
 * is cancellable for the entire window; anything the visitor touches cancels
 * it, not just the "stay here" target.
 */
const AUTO_ADVANCE_GAP_MS = 6000;

const AudioGuideScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { venueSlug, siteName } = route.params;
  const goBack = useSafeGoBack();
  const { isOffline } = useNetwork();

  // Derived from the app language unless the user overrode it in Settings.
  const lang = useNarrationLang();
  const persona = useMuseumPrefsStore(s => s.narrationPersona);
  const setPersona = useMuseumPrefsStore(s => s.setNarrationPersona);
  const autoAdvance = useMuseumPrefsStore(s => s.autoAdvance);
  const setAutoAdvance = useMuseumPrefsStore(s => s.setAutoAdvance);

  const [data, setData] = useState<AudioStopsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The selected stop is held by KEY, not by object: a refetch (persona or
  // language change) replaces every stop object, and holding the key lets the
  // selection survive it when the same stop exists in the new payload.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  /** Everything that is not the current stop. */
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * The visitor's own pause, ridden on `suspended` rather than the player's
   * internal `paused`, because the transport lives in the sheet and there is no
   * imperative handle to reach it with. `suspended` holds playback without
   * losing the position, which matters for clips of 105 s.
   */
  const [held, setHeld] = useState(false);
  /** What the player reports it is actually doing, for the glyph. */
  const [playerPaused, setPlayerPaused] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  /** The stop the guide is about to move on to, during the gap. */
  const [pendingNext, setPendingNext] = useState<AudioStop | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /**
   * The walking order. `stops` is already ordered by (sort_order, stop_key)
   * server-side, so this is the sequence previous/next step through — NOT the
   * grouped list, which would make the order depend on how zones happen to be
   * bucketed. Unrecorded stops are dropped: skipping over a row that cannot
   * play is what a guide does, and stepping onto one would strand the visitor
   * on a stop with no way forward but another tap.
   */
  const sequence = useMemo(() => stops.filter(isPlayable), [stops]);

  const selected: AudioStop | null = useMemo(
    () => stops.find(s => s.stop_key === selectedKey) ?? null,
    [stops, selectedKey],
  );

  /**
   * Arrive ON a stop, not on a list. The entry point is a button that says
   * "Listen", so the first playable stop is selected as soon as the payload
   * lands and `autoPlay` starts it. Only when nothing is selected: a refetch
   * after a persona change must not throw the visitor back to stop one.
   */
  useEffect(() => {
    if (!selectedKey && sequence.length > 0) {
      setSelectedKey(sequence[0].stop_key);
    }
  }, [selectedKey, sequence]);

  const position = useMemo(
    () => sequence.findIndex(s => s.stop_key === selectedKey),
    [sequence, selectedKey],
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

  /** Where to stand. Palace-only, and absent is left absent — see the header. */
  const walkTo = useMemo(
    () => walkToForStop(venueSlug, selected?.stop_key),
    [venueSlug, selected],
  );

  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setPendingNext(null);
  }, []);

  // Never leave a timer running into an unmounted screen: it would call
  // setState on a dead component and, worse, keep a stale stop pinned.
  useEffect(() => cancelAdvance, [cancelAdvance]);

  /**
   * Move to a stop. Every path in — a tap in the sheet, previous, next, the
   * auto-advance firing — comes through here, so the pending offer is always
   * cancelled and the visitor's pause is always lifted. A stop selected while
   * `held` was true would otherwise arrive silent.
   */
  const goToStop = useCallback(
    (stop: AudioStop | undefined | null) => {
      if (!stop || !isPlayable(stop)) return;
      cancelAdvance();
      setElapsedMs(0);
      setDurationMs(0);
      setHeld(false);
      setSelectedKey(stop.stop_key);
    },
    [cancelAdvance],
  );

  const goPrevious = useCallback(() => {
    if (position > 0) goToStop(sequence[position - 1]);
  }, [goToStop, position, sequence]);

  const goNext = useCallback(() => {
    if (position >= 0 && position < sequence.length - 1) {
      goToStop(sequence[position + 1]);
    }
  }, [goToStop, position, sequence]);

  /**
   * The clip finished. Offer the next stop rather than taking it: the visitor
   * may be standing in front of the thing the clip was about, and a guide that
   * walks off mid-sentence is the failure this gap exists to prevent.
   */
  const handleEnd = useCallback(() => {
    setElapsedMs(durationMs);
    const next = position >= 0 ? sequence[position + 1] : undefined;
    if (!autoAdvance || !next) return;
    setPendingNext(next);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setPendingNext(null);
      goToStop(next);
    }, AUTO_ADVANCE_GAP_MS);
  }, [autoAdvance, durationMs, goToStop, position, sequence]);

  /**
   * The file would not play. Offer the next stop on the same terms as a clip
   * that finished, because the alternative is a visitor standing in front of a
   * silent phone with no event ever coming — the clip cannot end if it never
   * started. Still an OFFER: it is refusable, and with auto-advance off nothing
   * happens at all, which is the same contract as a normal ending.
   */
  const handleError = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  /**
   * The one control that must work without looking. It also cancels a pending
   * advance, because pressing play at the end of a clip means "not yet" as
   * clearly as pressing "stay here" does.
   */
  const togglePlay = useCallback(() => {
    cancelAdvance();
    setHeld(v => !v);
  }, [cancelAdvance]);

  const sounding = !!selectedUri && !playerPaused && !held;
  const remainingMs = Math.max(0, durationMs - elapsedMs);

  /**
   * ONE instance, created here rather than inside the sheet so the big button
   * on the screen and the transport in the sheet drive the same component. No
   * `key` prop: changing `uri` swaps the source on the SAME player rather than
   * remounting it, which is what keeps the chosen speed across stops.
   */
  const playerNode =
    selected?.clip && selectedUri ? (
      <AudioPlayer
        uri={selectedUri}
        sourceKey={selected.stop_key}
        title={selected.title}
        autoPlay
        suspended={held}
        // The guide is meant to be listened to while walking, often with the
        // phone away. Without this the only way to pause is to unlock, find
        // the app and find the button — which is the same failure the big
        // play control on this screen exists to fix, one layer out.
        showNotificationControls
        notificationSubtitle={siteName}
        onPausedChange={setPlayerPaused}
        onLoad={d => setDurationMs(Math.round((d.duration ?? 0) * 1000))}
        onProgress={d => setElapsedMs(Math.round((d.currentTime ?? 0) * 1000))}
        onEnd={handleEnd}
        onError={handleError}
      />
    ) : null;

  // ---- states that are not "a stop is playing" ------------------------------

  const renderFallbackState = () => {
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
    if (sequence.length === 0) {
      return (
        <View style={styles.centered}>
          <Headphones size={26} color={COLORS.textTertiary} />
          <Text style={styles.emptyTitle}>{t('audioGuide.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('audioGuide.emptyBody')}</Text>
        </View>
      );
    }
    return null;
  };

  const fallback = renderFallbackState();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={styles.headerBtn}>
            <ChevronLeft size={22} color={COLORS.textPrimary} />
          </Pressable>
          <View style={styles.headerSpacer} />
          {fallback ? null : (
            <Pressable
              onPress={() => setSheetOpen(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('audioGuide.allStops')}
              style={styles.headerBtn}>
              <List size={22} color={COLORS.textPrimary} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {fallback ?? (
        <SafeAreaView style={styles.stage} edges={['bottom']}>
          {/* THE STOP. Zone, name, and where to stand — in that order, because
              that is the order a visitor needs them: which part of the building,
              what this one is called, how to get to it. */}
          <View style={styles.stop}>
            {selected?.zone ? (
              <Text style={styles.zone}>{formatZoneLabel(selected.zone)}</Text>
            ) : null}
            <Text style={styles.title}>{selected?.title ?? ''}</Text>
            {walkTo ? <Text style={styles.walkTo}>{walkTo}</Text> : null}

            {/* WHAT LANGUAGE THIS ACTUALLY IS. A truth claim about the thing
                playing right now, so it stays on the screen rather than moving
                into the sheet with the preferences. */}
            {data?.fallback_lang ? (
              <View style={styles.notice}>
                <Info size={13} color={COLORS.textTertiary} />
                <Text style={styles.noticeText}>
                  {t('audioGuide.fallbackNotice')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* THE TRANSPORT. Three targets, the middle one large enough to hit
              without looking at the phone. */}
          <View style={styles.transportBlock}>
            <Text style={styles.remaining}>
              {durationMs > 0 ? `−${formatClipDuration(remainingMs)}` : ' '}
            </Text>

            <View style={styles.transport}>
              <Pressable
                onPress={goPrevious}
                disabled={position <= 0}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={t('audioGuide.previousStop')}
                style={[styles.step, position <= 0 && styles.stepOff]}>
                <SkipBack size={24} color={COLORS.textPrimary} />
              </Pressable>

              <Pressable
                onPress={togglePlay}
                accessibilityRole="button"
                accessibilityLabel={
                  sounding ? t('audioGuide.pause') : t('audioGuide.play')
                }
                style={styles.playBtn}>
                {sounding ? (
                  <Pause size={32} color={COLORS.bg} fill={COLORS.bg} />
                ) : (
                  <Play size={32} color={COLORS.bg} fill={COLORS.bg} />
                )}
              </Pressable>

              <Pressable
                onPress={goNext}
                disabled={position < 0 || position >= sequence.length - 1}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={t('audioGuide.nextStop')}
                style={[
                  styles.step,
                  (position < 0 || position >= sequence.length - 1) &&
                    styles.stepOff,
                ]}>
                <SkipForward size={24} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            {/* THE OFFER, not the act. Visible for the whole gap, and refusable
                without hunting for a control. */}
            {pendingNext ? (
              <View style={styles.movingOn}>
                <Text style={styles.movingOnText} numberOfLines={1}>
                  {t('audioGuide.movingOn', { title: pendingNext.title })}
                </Text>
                <Pressable
                  onPress={cancelAdvance}
                  hitSlop={12}
                  accessibilityRole="button"
                  style={styles.stayBtn}>
                  <Text style={styles.stayText}>
                    {t('audioGuide.stayHere')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* WHERE YOU ARE IN THE GUIDE. One tick per stop, replacing four
                zone headings and eight rows that were carrying this one fact
                between them. */}
            <View
              style={styles.ticks}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 1,
                max: sequence.length,
                now: position + 1,
              }}>
              {sequence.map((s, i) => (
                <View
                  key={s.stop_key}
                  style={[styles.tick, i === position && styles.tickOn]}
                />
              ))}
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* EVERYTHING ELSE, one tap away. Always mounted: the player lives in
          here, and unmounting would restart the clip on every close. */}
      <AudioGuideSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        groups={groups}
        selectedKey={selectedKey}
        selected={selected}
        onSelectStop={stop => {
          goToStop(stop);
          setSheetOpen(false);
        }}
        restorationUri={restorationUri}
        onOpenRestoration={() => {
          if (!selected || !restorationUri) return;
          navigation.navigate(ROUTES.MAIN.RESTORATION, {
            imageUrl: restorationUri,
            caption: selected.clip?.restoration_caption,
            title: selected.title,
            siteName,
          });
        }}
        persona={persona}
        onSelectPersona={setPersona}
        autoAdvance={autoAdvance}
        onAutoAdvanceChange={setAutoAdvance}
        player={playerNode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { flex: 1 },

  // ---- the stop ------------------------------------------------------------
  stage: { flex: 1, justifyContent: 'space-between' },
  stop: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl },
  zone: {
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.caption,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 41,
    marginBottom: SPACING.lg,
  },
  walkTo: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.body,
    lineHeight: 24,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },
  noticeText: {
    flex: 1,
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.caption,
    lineHeight: 17,
  },

  // ---- the transport -------------------------------------------------------
  transportBlock: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  remaining: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.small,
    textAlign: 'center',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xxxl,
  },
  step: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: { opacity: 0.25 },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movingOn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  movingOnText: {
    flexShrink: 1,
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.small,
  },
  stayBtn: { paddingVertical: 4, paddingHorizontal: SPACING.sm },
  stayText: {
    color: COLORS.amber,
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.small,
  },
  ticks: { flexDirection: 'row', gap: 4 },
  tick: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tickOn: { backgroundColor: COLORS.amber, height: 3 },


  // ---- states that are not a stop -----------------------------------------
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.subtitle,
    textAlign: 'center',
  },
  emptyBody: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.small,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.small,
  },
});

export default AudioGuideScreen;
