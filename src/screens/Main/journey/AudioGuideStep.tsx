/**
 * AudioGuideStep — step 3 of the journey. The venue's audio stops, in walking
 * order and grouped by zone, one at a time: the visitor listens, walks, and the
 * guide moves on by itself. The stop reached is written to journeyStore so a
 * killed app resumes at the same place.
 *
 * IT WALKS ITSELF ON PURPOSE. The brief for this product is a GUIDED journey —
 * the visitor is led rather than left to wander, audio running throughout — and
 * the lawn already showed what happens when the app instead waits for a tap the
 * visitor has no reason to expect: the owner heard the welcome finish, saw
 * nothing happen, and reported the journey frozen. This step had exactly the
 * same shape (every stop started paused and every hand-over was a "Next stop"
 * tap), so it would have failed the same way one screen later.
 *
 * The visitor still has the wheel, three ways: pausing the audio stops the
 * clock entirely, "Stay on this stop" cancels a hand-over that is already
 * counting down, and Next/Previous work exactly as they did.
 *
 * WHAT IT WILL NOT DO. Leading is only leading while the visitor is hearing
 * something. A stop that played NOTHING — broken file, dead connection, no
 * recording — hands over at most once, and never when they pressed "Previous"
 * to get to it, never off the last stop, and never straight after another stop
 * that played nothing. Without those three refusals the same beat that leads a
 * visitor also (a) shoves them back out of a stop they stepped back into, four
 * seconds after they chose it, (b) ends the whole guide from a silent last stop,
 * so pressing back into the guide ejects them again, for ever, and (c) on a weak
 * signal at the site burns every remaining stop at four seconds each and dumps
 * them on the next step with every stop marked as heard. See scheduleAdvance.
 *
 * "Finished" is decided by useAudioCompletion, never by <Video onEnd> alone.
 * onEnd is a single point of failure on Android — audio focus can be denied at
 * un-pause or lost mid-clip, and either one stops the sound with no event of any
 * kind — so a chain that advanced only on onEnd would strand the visitor the
 * first time that happened, in the middle of a walk, with no way to tell.
 *
 * Playback goes through the existing AudioPlayer (scrub bar, speed, skip). The
 * file is read from the media cache when it was saved on the lawn and streamed
 * when it was not — nothing here downloads on the visitor's time.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Pause, SkipBack } from 'lucide-react-native';

import AudioPlayer from '../../../components/AudioPlayer';
import { Skeleton } from '../../../components/ui';
import { COLORS } from '../../../core/constants/theme';
import { analytics } from '../../../services/analytics';
import { buildAudioUrl, getCachedMediaUri } from '../../../services/mediaCache';
import { groupStopsByZone } from '../../../utils/api/audio';
import type { AudioStop, AudioStopsResponse } from '../../../utils/api/audio';
import useAudioCompletion, {
  type AudioCompletionReason,
} from './useAudioCompletion';
import { viewpointForStop } from '../../../features/magicwindow/tour';
import {
  GhostButton,
  JOURNEY_GOLD,
  JOURNEY_INK,
  PrimaryButton,
  journeyStyles,
} from './JourneyUi';

/**
 * How long the guide waits, once a stop's audio has finished, before walking on
 * to the next one.
 *
 * A beat, not a delay. Long enough that the hand-over reads as deliberate and
 * that "Stay on this stop" can genuinely be seen and pressed by someone who
 * wants to linger over the transcript; short enough that a visitor standing in
 * the sun does not decide the guide has stopped working — which is the exact
 * misreading this whole change exists to prevent. The same beat covers a stop
 * that failed and a stop that was never recorded, so every kind of ending feels
 * the same from the outside.
 */
const ADVANCE_BEAT_MS = 4000;

export type StopsStatus = 'loading' | 'ready' | 'error';

interface Props {
  status: StopsStatus;
  stops: AudioStopsResponse | null;
  onRetry: () => void;
  /** Stop to resume at (journeyStore.lastStopKey); null starts from the first. */
  initialStopKey: string | null;
  onStopChange: (stopKey: string) => void;
  /**
   * Open the magic window at the viewpoint that stands where this stop is
   * heard. A CALLBACK rather than a useNavigation() call inside the step,
   * because every other step here takes props in and hands callbacks out — the
   * parent owns the machine and owns the navigator. Omitted = no link shown.
   */
  onOpenReconstruction?: (viewpointId: string) => void;
  onContinue: () => void;
}

interface Entry {
  stop: AudioStop;
  zone: string | null;
}

/** Why a hand-over is pending: whatever ended the audio, or that there was none. */
type PendingReason = AudioCompletionReason | 'silent';

/**
 * Did the visitor actually hear this stop?
 *
 * 'ended' and 'duration' mean the clip ran its length — the guide has done its
 * job and leading them to the next stop is the whole promise of the product.
 * The other three mean they heard nothing: the file was broken, the player died
 * mid-clip, or there is no recording at all. Walking on from ONE of those is
 * kindness (a gap in the narration, not a stop sign); walking on from a RUN of
 * them is the guide running away from the visitor, which is what
 * `scheduleAdvance` refuses below.
 *
 * 'stalled' is counted as heard-nothing even though some of the clip may have
 * played: it means the player stopped for a reason we cannot see (audio focus
 * lost to a call, a connection that died mid-stream), and the next stop is
 * overwhelmingly likely to hit the same wall.
 */
const heardNothing = (why: PendingReason | null): boolean =>
  why === 'error' || why === 'stalled' || why === 'silent';

interface StopPlayerProps {
  uri: string;
  title: string;
  /** Fired once, however this stop's audio ended — including badly. */
  onFinished: (reason: AudioCompletionReason) => void;
}

/**
 * One stop's audio, with the four-signal completion watchdog wrapped round it.
 *
 * It is its own component, mounted with key={stop_key}, for a reason that bites
 * otherwise: useAudioCompletion caches the clip's duration deliberately (a
 * replay after seek(0) may never re-emit onLoad), and a duration cached from the
 * PREVIOUS stop would arm a backstop of the wrong length against the next one —
 * a 30 s stop followed by a two-minute stop would be cut off after 31 s and the
 * guide would run away from the visitor. Remounting throws that state away
 * alongside the player it belongs to, which is exactly what the key on
 * AudioPlayer already did for the scrub bar.
 */
const StopPlayer: React.FC<StopPlayerProps> = ({ uri, title, onFinished }) => {
  // Mirrors AudioPlayer's own play/pause state, reported by onPausedChange. The
  // watchdog must see it: a visitor who pauses to look at a carving is not a
  // stalled player, and treating one as the other would march the guide onward
  // without them.
  const [paused, setPaused] = useState(false);
  const audio = useAudioCompletion({ paused, onComplete: onFinished });

  return (
    <AudioPlayer
      uri={uri}
      title={title}
      autoPlay
      onPausedChange={setPaused}
      // onLoad / onProgress / onEnd / onError, as one memoised object.
      {...audio.handlers}
    />
  );
};

const AudioGuideStep: React.FC<Props> = ({
  status,
  stops,
  onRetry,
  initialStopKey,
  onStopChange,
  onOpenReconstruction,
  onContinue,
}) => {
  const { t } = useTranslation();

  // Flatten the zone groups back into walking order, keeping each stop's zone
  // beside it so the header can say where the visitor is and where to go next.
  const ordered = useMemo<Entry[]>(
    () =>
      groupStopsByZone(stops?.stops ?? []).flatMap(group =>
        group.stops.map(stop => ({ stop, zone: group.zone })),
      ),
    [stops],
  );

  // Resume at the saved stop. Decided once: at mount when the stops are already
  // here, otherwise the first time they arrive — never again on later renders.
  const [index, setIndex] = useState(() =>
    Math.max(0, ordered.findIndex(e => e.stop.stop_key === initialStopKey)),
  );
  const resumedRef = useRef(ordered.length > 0);
  useEffect(() => {
    if (resumedRef.current || ordered.length === 0) return;
    resumedRef.current = true;
    const at = ordered.findIndex(e => e.stop.stop_key === initialStopKey);
    if (at > 0) setIndex(at);
  }, [ordered, initialStopKey]);

  const current = ordered[Math.min(index, Math.max(0, ordered.length - 1))];

  // The magic-window viewpoint that stands where this stop is heard, if any.
  const mwViewpointId = viewpointForStop(
    stops?.monument_id,
    current?.stop.stop_key,
  );
  const next = ordered[index + 1];
  const isLast = ordered.length > 0 && index >= ordered.length - 1;

  // journeyStore.lastStopKey follows the stop on EVERY transition, manual or
  // automatic, because both of them land here as a change of `current`.
  useEffect(() => {
    if (current) onStopChange(current.stop.stop_key);
  }, [current, onStopChange]);

  // Cached file:// when the lawn pre-cache saved it, otherwise the CDN URL.
  const audioUrl = useMemo(
    () => buildAudioUrl(current?.stop.clip?.audio_url),
    [current],
  );
  const [resolved, setResolved] = useState<{url: string; uri: string} | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!audioUrl) {
      setResolved(null);
      return;
    }
    void getCachedMediaUri(audioUrl)
      .then(cached => {
        if (!cancelled) setResolved({url: audioUrl, uri: cached ?? audioUrl});
      })
      .catch(() => {
        if (!cancelled) setResolved({url: audioUrl, uri: audioUrl});
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  /**
   * Only the file that belongs to THIS stop may reach the player, and the check
   * is derived rather than an effect that nulls the state — because an effect
   * runs after the render that changed the stop, and for that one render the
   * previous stop's file is still sitting in state. The player is keyed by stop,
   * so it would mount fresh AND autoplay, and the visitor would hear a second of
   * the clip they have just finished before it was torn down again.
   */
  const audioUri = resolved && resolved.url === audioUrl ? resolved.uri : null;

  // ---- The hand-over. One pending advance at a time, always cancellable. ----
  const [pending, setPending] = useState<PendingReason | null>(null);
  /**
   * A stop that ended with nothing heard and that the guide deliberately did
   * NOT walk away from. Distinct from `pending` because the copy differs: one
   * says "moving on in a moment", the other has to say "this didn't play" and
   * then stand still, and promising to move while standing still is exactly the
   * kind of lie that made the lawn read as frozen.
   */
  const [held, setHeld] = useState<PendingReason | null>(null);
  const [stayed, setStayed] = useState(false);
  /** Bumped by "Try again", to remount the player on the SAME stop. */
  const [attempt, setAttempt] = useState(0);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latched once the guide has handed the journey to the next step. */
  const leftStepRef = useRef(false);
  /**
   * May the guide lead on from the stop showing now?
   *
   * True at mount — opening or resuming the guide is the visitor asking to be
   * led from wherever it starts — and true after every forward move. False after
   * "Previous", which is the one navigation that says "I want THIS stop", and
   * where leading on again simply undoes the tap that got them there.
   */
  const mayLeadOnRef = useRef(true);
  /** How the stop before this one ended, so a run of failures cannot chain. */
  const lastEndingRef = useRef<PendingReason | null>(null);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const handleNext = useCallback(
    (via: 'manual' | 'auto' = 'auto') => {
      clearAdvanceTimer();
      setPending(null);
      setHeld(null);
      // A tap is a fresh start for the chaining rules: one dead file must not
      // switch auto-advance off for the rest of the walk once the visitor has
      // stepped past it themselves.
      if (via === 'manual') lastEndingRef.current = null;
      if (isLast) {
        // completeStep is idempotent but the analytics event behind onContinue
        // is not, so the exit is latched. Safe against stranding anyone:
        // completing 'guide' moves journeyStore past this step, which unmounts
        // this screen.
        if (leftStepRef.current) return;
        leftStepRef.current = true;
        onContinue();
        return;
      }
      // The guide put them on the next stop, so it may lead on from that one.
      mayLeadOnRef.current = true;
      setIndex(i => Math.min(i + 1, ordered.length - 1));
    },
    [clearAdvanceTimer, isLast, onContinue, ordered.length],
  );

  // The timer body must call the CURRENT handleNext, never the one captured when
  // it was armed: `isLast` and `onContinue` both change under it (the parent
  // hands this step a fresh inline arrow on every render, and it re-renders
  // repeatedly while the media pre-cache reports progress). Putting handleNext
  // in a dependency array instead would re-arm the beat on every one of those
  // renders, and it would never fire.
  const handleNextRef = useRef(handleNext);
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const scheduleAdvance = useCallback(
    (why: PendingReason) => {
      if (leftStepRef.current || advanceTimerRef.current) return;
      const previous = lastEndingRef.current;
      lastEndingRef.current = why;

      // An ending where the visitor heard the stop leads them on, always — that
      // is the guide doing its job. An ending where they heard NOTHING leads
      // them on only if all three of these hold. Each one is a way the guide was
      // observed to shove somebody:
      if (heardNothing(why)) {
        //  1. They did not press "Previous" to get here. A stop with no
        //     recording (or a broken file) used to shove them forward again four
        //     seconds after they deliberately stepped back into it, and pressing
        //     Previous again just repeated it — so everything behind a silent
        //     stop was unreachable by the only control for reaching it.
        //  2. It is not the last stop. Completing 'guide' from a stop that
        //     played nothing puts them on 'explore', and pressing back returns
        //     them here, to that same stop, which ejects them again four seconds
        //     later — a loop with no way to stay on the guide at all.
        //  3. The stop before it played. Two dead endings in a row is a broken
        //     connection or a venue seeded ahead of its recordings, not a walk:
        //     chaining consumes every remaining stop at four seconds each,
        //     leaves the guide entirely, and persists lastStopKey at the end so
        //     coming back resumes them nowhere near where they were.
        if (!mayLeadOnRef.current || isLast || heardNothing(previous)) {
          setPending(null);
          setHeld(why);
          return;
        }
      }

      setHeld(null);
      setPending(why);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        handleNextRef.current();
      }, ADVANCE_BEAT_MS);
    },
    [isLast],
  );

  const handleFinished = useCallback(
    (reason: AudioCompletionReason) => {
      // `reason` is the whole point of carrying the watchdog: it is the only way
      // to tell a healthy 'ended' from a phone where onEnd never arrived
      // ('duration' / 'stalled'), which is the question the site report could
      // not answer for the welcome either.
      analytics.track('journey_stop_finished', {
        stop: current?.stop.stop_key,
        reason,
      });
      scheduleAdvance(reason);
    },
    [current, scheduleAdvance],
  );

  // A new stop starts clean: no hand-over in flight, and the visitor's "stay
  // here" applied to the stop they asked it for, not to the rest of the guide.
  // Declared BEFORE the silent-stop effect below so that on a stop change this
  // clears first and that one re-arms after.
  useEffect(() => {
    clearAdvanceTimer();
    setPending(null);
    setHeld(null);
    setStayed(false);
    setAttempt(0);
  }, [current, clearAdvanceTimer]);

  // A stop with nothing to play must not become a dead end. Not every stop has
  // been recorded, and a screen that then sits there waiting for a tap is the
  // same failure as the frozen lawn — the visitor has been told they are being
  // guided, so an unrecorded stop should be a gap in the narration, not a stop
  // sign. scheduleAdvance decides whether this particular gap may be walked
  // over: on a stop reached with "Previous", on the last stop, or straight after
  // another stop that played nothing, it holds instead.
  useEffect(() => {
    if (!current || audioUrl || stayed) return;
    scheduleAdvance('silent');
  }, [current, audioUrl, stayed, scheduleAdvance]);

  // Nothing may outlive the screen: a beat still counting down after the visitor
  // has left would advance a journey nobody is on.
  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

  const handlePrevious = useCallback(() => {
    clearAdvanceTimer();
    setPending(null);
    setHeld(null);
    // Going BACK is the visitor choosing this stop, so the guide must not lead
    // out of it: a stop with no recording (or a broken file) used to bounce them
    // forward again four seconds after they pressed Previous, which made every
    // stop behind a silent one unreachable by the only control for reaching it.
    mayLeadOnRef.current = false;
    lastEndingRef.current = null;
    setIndex(i => Math.max(0, i - 1));
  }, [clearAdvanceTimer]);

  /** Cancel a hand-over that is counting down and leave the visitor in place. */
  const handleStay = useCallback(() => {
    clearAdvanceTimer();
    setPending(null);
    setHeld(null);
    setStayed(true);
  }, [clearAdvanceTimer]);

  /**
   * "Try again" on a stop whose audio would not play.
   *
   * Remounting the player is the only way back: an ExoPlayer that has reported a
   * source error will not play again on a bare un-pause, so the Play button on
   * the player itself is dead after a failure. A fresh key rebuilds it and
   * autoplays, which on a connection that has come back is all it takes.
   *
   * `lastEndingRef` is deliberately NOT cleared: if the retry fails too, the
   * guide holds here again rather than treating this as a fresh healthy stop and
   * resuming the chain that the failure rules just stopped.
   */
  const handleRetryStop = useCallback(() => {
    clearAdvanceTimer();
    setPending(null);
    setHeld(null);
    setAttempt(n => n + 1);
  }, [clearAdvanceTimer]);

  const zoneLabel = useCallback(
    (zone: string | null) =>
      zone
        ? t(`journey.guide.zones.${zone}`, {
            defaultValue: t('journey.guide.zones.other'),
          })
        : t('journey.guide.zones.other'),
    [t],
  );

  const header = (
    <>
      <Text style={journeyStyles.eyebrow}>{t('journey.guide.eyebrow')}</Text>
      <Text style={journeyStyles.title}>{t('journey.guide.title')}</Text>
    </>
  );

  if (status === 'loading') {
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={[journeyStyles.page, journeyStyles.pageContent]}>
          {header}
          <Skeleton height={18} width="45%" />
          <Skeleton height={28} width="80%" />
          <Skeleton height={140} radius={16} />
          <Skeleton height={16} />
          <Skeleton height={16} width="90%" />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error' || ordered.length === 0) {
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={[journeyStyles.page, journeyStyles.pageContent]}>
          {header}
          <Text style={journeyStyles.body}>
            {status === 'error' ? t('journey.guide.loadError') : t('journey.guide.empty')}
          </Text>
          <View style={journeyStyles.buttonRow}>
            {status === 'error' ? (
              <PrimaryButton label={t('common.tryAgain')} onPress={onRetry} />
            ) : null}
            <GhostButton
              label={t('journey.guide.toExplore')}
              icon={<ChevronRight size={18} color={JOURNEY_GOLD} />}
              onPress={onContinue}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const clip = current.stop.clip;
  const fellBack = !!stops?.fallback_lang && !!clip && clip.lang !== stops.lang;
  const handingOver = pending !== null;
  /** Ended badly and we are NOT moving: the visitor needs a reason and a way out. */
  const heldOnFailure = held === 'error' || held === 'stalled';

  return (
    <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={journeyStyles.page}
        contentContainerStyle={journeyStyles.pageContent}
        showsVerticalScrollIndicator={false}>
        {header}

        <View style={styles.stopHead}>
          <Text style={journeyStyles.caption}>
            {t('journey.guide.stopOf', { n: index + 1, total: ordered.length })}
            {' · '}
            {t('journey.guide.nowIn', { zone: zoneLabel(current.zone) })}
          </Text>
          <Text style={styles.stopTitle}>{current.stop.title}</Text>
        </View>

        {/* Said once, at the top: the visitor should know the guide walks itself
            BEFORE the first hand-over happens, not be surprised by it. */}
        <Text style={journeyStyles.caption}>{t('journey.guide.autoHint')}</Text>

        {/* Gated on the URL, not on the clip record: a clip row with no audio
            file is "not recorded" as far as the visitor is concerned, and
            showing a skeleton that never resolves would be a lie. */}
        {audioUrl ? (
          audioUri ? (
            <StopPlayer
              key={`${current.stop.stop_key}#${attempt}`}
              uri={audioUri}
              title={current.stop.title}
              onFinished={handleFinished}
            />
          ) : (
            <Skeleton height={150} radius={16} />
          )
        ) : (
          <View style={styles.notRecorded}>
            <Text style={journeyStyles.body}>{t('journey.guide.notRecorded')}</Text>
          </View>
        )}

        {fellBack ? (
          <Text style={journeyStyles.caption}>{t('journey.guide.fallbackNotice')}</Text>
        ) : null}

        {clip?.transcript ? (
          <View style={styles.transcript}>
            <Text style={journeyStyles.eyebrow}>{t('journey.guide.transcript')}</Text>
            <Text style={journeyStyles.body}>{clip.transcript}</Text>
          </View>
        ) : null}

        {/* THE ROOM THIS STOP IS ABOUT, RECONSTRUCTED. The magic window has a
            viewpoint standing exactly where each stop is heard, and until now
            the two shipped as unconnected screens. Passing the viewpoint means
            the visitor lands looking at the right thing instead of at a list of
            eight place names.

            No extra gate: entry to the journey is already admin-only
            (canBeginJourney -> isAdminUser), the same gate SiteDetail puts on
            the magic window. viewpointForStop returns undefined for any venue
            without a magic window, so this simply does not render elsewhere. */}
        {mwViewpointId && onOpenReconstruction ? (
          <GhostButton
            label={t('journey.guide.seeReconstruction')}
            onPress={() => onOpenReconstruction(mwViewpointId)}
          />
        ) : null}

        {next && next.zone !== current.zone ? (
          <Text style={journeyStyles.bodyStrong}>
            {t('journey.guide.walkTo', { zone: zoneLabel(next.zone) })}
          </Text>
        ) : null}
        {isLast ? <Text style={journeyStyles.body}>{t('journey.guide.finished')}</Text> : null}

        {/* The hand-over, announced. 'error' gets its own calm line because the
            visitor heard nothing and deserves to know why they are moving on. */}
        {handingOver ? (
          <Text style={journeyStyles.bodyStrong}>
            {pending === 'error' || pending === 'stalled'
              ? t('journey.guide.audioFailed')
              : isLast
                ? t('journey.guide.autoFinish')
                : t('journey.guide.autoNext')}
          </Text>
        ) : null}

        {/* Stopped, not moving on. Says so in its own words: the copy above ends
            with "moving on in a moment", and printing that while standing still
            is the promise-then-nothing that read as a freeze in the first place.
            A held 'silent' needs no line — the "not recorded" card above already
            explains it, and Next is right there. */}
        {heldOnFailure ? (
          <Text style={journeyStyles.bodyStrong}>
            {t('journey.guide.audioFailedStopped')}
          </Text>
        ) : null}

        <View style={journeyStyles.buttonRow}>
          <PrimaryButton
            label={isLast ? t('journey.guide.toExplore') : t('journey.guide.next')}
            icon={<ChevronRight size={18} color={JOURNEY_INK} />}
            onPress={() => handleNext('manual')}
          />
          {heldOnFailure ? (
            <GhostButton label={t('common.tryAgain')} onPress={handleRetryStop} />
          ) : null}
          {handingOver ? (
            <GhostButton
              label={t('journey.guide.stay')}
              icon={<Pause size={16} color={JOURNEY_GOLD} />}
              onPress={handleStay}
            />
          ) : null}
          <GhostButton
            label={t('journey.guide.previous')}
            icon={<SkipBack size={16} color={JOURNEY_GOLD} />}
            onPress={handlePrevious}
            disabled={index === 0}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  stopHead: { gap: 4, marginTop: 4 },
  stopTitle: {
    fontFamily: 'Fraunces-Regular',
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.textPrimary,
  },
  notRecorded: {
    backgroundColor: COLORS.bgWarm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  transcript: {
    backgroundColor: COLORS.bgWarm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 8,
  },
});

export default AudioGuideStep;
