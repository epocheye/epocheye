/**
 * PalaceJourneyScreen — the guided on-site journey (ROUTES.MAIN.PALACE_JOURNEY).
 *
 *   1. arrival  — on the lawn: the host figure appears, faces the visitor and
 *                 speaks the welcome; the guide's media is saved while he talks
 *   2. prepare  — walk forward, earphones in, and the ONE disclaimer
 *   3. guide    — zone-grouped audio stops, in walking order
 *   4. explore  — point-and-learn: a frame → /api/v1/recognize → a world-anchored
 *                 card at the visitor's tap (video on the card when there is one)
 *
 * The screen owns what the steps share: the safety gate, AR capability and the
 * camera permission, the audio-stop list, the pre-cache run, journey progress
 * (journeyStore, persisted per venue so a killed app resumes at the same step),
 * the leave/back handling and the full-screen video overlay. Each step owns its
 * own native AR view so the session is torn down between steps.
 *
 * Back handling: every affordance — the X, the back chevron, the Android
 * hardware button — goes through useSafeBackHandler so exiting can never fall
 * through to closing the app. Hardware back closes the video first, then steps
 * back one step, and on the first step asks before leaving.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ARSafetyNotice from '../../components/ui/ARSafetyNotice';
import ARCapabilityNotice from '../../components/ui/ARCapabilityNotice';
import { ROUTES } from '../../core/constants/routes';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { useSafeBackHandler, useSafeGoBack } from '../../shared/hooks/useSafeGoBack';
import {
  isNonArCapability,
  useARCapability,
} from '../../shared/hooks/useARCapability';
import { PermissionService } from '../../shared/services/permission.service';
import { AppAlert } from '../../shared/ui/appAlert';
import { analytics } from '../../services/analytics';
import {
  JOURNEY_TEST_VIDEO_URL,
  buildAudioUrl,
  prefetchMedia,
  type PrefetchSummary,
} from '../../services/mediaCache';
import { listAudioStops, type AudioStopsResponse } from '../../utils/api/audio';
import {
  useMuseumPrefsStore,
  useNarrationLang,
} from '../../stores/museumPrefsStore';
import {
  JOURNEY_STEPS,
  currentStepId,
  isJourneyComplete,
  selectJourneyProgress,
  useJourneyStore,
} from '../../stores/journeyStore';

import {
  journeyFigureUrl,
  journeyHostFor,
  journeyWelcomeUrl,
} from './journey/journeyConfig';
import { useJourneyGate } from './journey/useJourneyGate';
import LawnStep from './journey/LawnStep';
import PromptStep from './journey/PromptStep';
import AudioGuideStep, { type StopsStatus } from './journey/AudioGuideStep';
import PointLearnStep from './journey/PointLearnStep';
import FullscreenVideo from './journey/FullscreenVideo';
import {
  GhostButton,
  JourneyTopBar,
  PrimaryButton,
  journeyStyles,
} from './journey/JourneyUi';

type Props = MainScreenProps<'PalaceJourney'>;

/** Kannada is out of scope for the slice; the guide is served in English. */
// MERGE CASUALTY, fixed. `main` and ota/ar-safety-v21 both rewrote
// museumPrefsStore; v3 survived with narrationLangOverride + narrationPersona,
// and SiteDetailScreen and AudioGuideScreen both carry those through to
// /api/v1/audio/stops. This screen kept a hard-coded pair, so a Hindi or Bengali
// visitor on the palace journey was served English 'casual' clips whatever they
// had chosen in Settings. Read the store like the other two callers do.

/**
 * zustand's persist hydrates from AsyncStorage asynchronously. Until it has,
 * the store reads as "never started" — so the resume offer must wait for it.
 */
function useJourneyHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useJourneyStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useJourneyStore.persist.onFinishHydration(() => setHydrated(true));
    // Hydration may have finished between the initial read and subscribing.
    if (useJourneyStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, [hydrated]);
  return hydrated;
}

type CameraState = 'unknown' | 'granted' | 'denied';
type ResumeOffer = 'pending' | 'shown' | 'decided';

const PalaceJourneyScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const slug = route.params.slug;
  // The visitor's own narration settings, resolved exactly as
  // SiteDetailScreen and AudioGuideScreen resolve them.
  const guideLang = useNarrationLang();
  const guidePersona = useMuseumPrefsStore(st => st.narrationPersona);
  const host = useMemo(() => journeyHostFor(slug), [slug]);

  // ---- Progress (persisted per venue) ----
  const hydrated = useJourneyHydrated();
  const progress = useJourneyStore(selectJourneyProgress(slug));
  const goToStep = useJourneyStore(s => s.goToStep);
  const completeStep = useJourneyStore(s => s.completeStep);
  const setLastStopKey = useJourneyStore(s => s.setLastStopKey);
  const resetProgress = useJourneyStore(s => s.reset);
  const stepIndex = progress.stepIndex;
  const stepId = currentStepId(progress);

  // ---- Gates ----
  // Families-policy safety notice: plain component state, never persisted, so
  // it shows on every fresh launch of the AR section (see useARSafetyGate).
  const [acknowledged, setAcknowledged] = useState(false);
  const [resumeOffer, setResumeOffer] = useState<ResumeOffer>('pending');
  const { capability, recheck } = useARCapability();
  const [capabilityNoticeDone, setCapabilityNoticeDone] = useState(false);
  const [camera, setCamera] = useState<CameraState>('unknown');
  const [done, setDone] = useState(false);
  const [video, setVideo] = useState<{ uri: string; poster?: string } | null>(null);

  // GEOFENCE. Entry is refused off-site, which also closes the deep-link route into
  // the journey (a link reaches this screen without ever passing the Site Detail CTA).
  // Admins get state 'bypass' and a standing banner rather than a silent pass.
  const journeyGate = useJourneyGate(slug);

  const arCapable = capability === 'ready';
  const nonAr = isNonArCapability(capability);

  // ---- Back / leave ----
  const leave = useSafeGoBack();
  const confirmLeave = useCallback(() => {
    AppAlert.confirm({
      title: t('journey.leave.title'),
      message: t('journey.leave.body'),
      confirmText: t('journey.leave.leave'),
      cancelText: t('journey.leave.stay'),
      onConfirm: leave,
    });
  }, [t, leave]);
  const goPrevious = useCallback(() => {
    if (stepIndex > 0) goToStep(slug, stepIndex - 1);
  }, [slug, stepIndex, goToStep]);
  const intercept = useCallback((): boolean => {
    if (video) {
      setVideo(null);
      return true;
    }
    // Gates and the finish screen exit directly; only a live step is a place
    // worth guarding.
    if (!acknowledged || resumeOffer === 'shown' || done) return false;
    if (stepIndex > 0) {
      goPrevious();
      return true;
    }
    confirmLeave();
    return true;
  }, [video, acknowledged, resumeOffer, done, stepIndex, goPrevious, confirmLeave]);
  useSafeBackHandler(intercept);

  // ---- Resume offer, decided once per visit, after hydration ----
  useEffect(() => {
    if (!hydrated || resumeOffer !== 'pending') return;
    const started =
      progress.updatedAt > 0 &&
      (progress.stepIndex > 0 || progress.completedSteps.length > 0);
    setResumeOffer(started ? 'shown' : 'decided');
    analytics.track('journey_opened', { slug, resumable: started });
  }, [hydrated, resumeOffer, progress, slug]);

  // ---- Camera, asked only after the safety notice so the prompts never stack ----
  const requestCamera = useCallback(() => {
    void PermissionService.request('camera').then(granted =>
      setCamera(granted ? 'granted' : 'denied'),
    );
  }, []);
  useEffect(() => {
    if (!acknowledged || !arCapable || camera !== 'unknown') return;
    requestCamera();
  }, [acknowledged, arCapable, camera, requestCamera]);

  // ---- Audio stops (shared by the pre-cache and the guide step) ----
  const [stopsStatus, setStopsStatus] = useState<StopsStatus>('loading');
  const [stops, setStops] = useState<AudioStopsResponse | null>(null);
  const loadStops = useCallback(async () => {
    setStopsStatus('loading');
    const res = await listAudioStops(slug, { lang: guideLang, persona: guidePersona });
    if (res.success) {
      setStops(res.data);
      setStopsStatus('ready');
    } else {
      if (__DEV__) console.warn('[journey] audio stops failed', res.error);
      setStops(null);
      setStopsStatus('error');
    }
  }, [slug, guideLang, guidePersona]);
  useEffect(() => {
    if (acknowledged) void loadStops();
  }, [acknowledged, loadStops]);

  // ---- Pre-cache: the figure, the welcome, every stop's audio, any card video.
  //      Wanted from the moment the welcome starts (or on resuming past the
  //      lawn); starts once the stop list has settled so their URLs are known.
  const [prefetchWanted, setPrefetchWanted] = useState(false);
  const [prefetch, setPrefetch] = useState<PrefetchSummary | null>(null);
  const [prefetchDone, setPrefetchDone] = useState(false);
  const prefetchStartedRef = useRef(false);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const wantPrefetch = useCallback(() => setPrefetchWanted(true), []);
  useEffect(() => {
    if (stepIndex >= 1) setPrefetchWanted(true);
  }, [stepIndex]);
  useEffect(() => {
    if (!prefetchWanted || prefetchStartedRef.current || !host) return;
    if (stopsStatus === 'loading') return;
    prefetchStartedRef.current = true;
    const controller = new AbortController();
    prefetchAbortRef.current = controller;
    const urls = [
      journeyFigureUrl(host),
      journeyWelcomeUrl(host),
      ...(stops?.stops ?? []).map(s => buildAudioUrl(s.clip?.audio_url)),
      JOURNEY_TEST_VIDEO_URL,
    ];
    void prefetchMedia(urls, { onProgress: setPrefetch, signal: controller.signal }).then(
      summary => {
        setPrefetch(summary);
        setPrefetchDone(true);
      },
    );
  }, [prefetchWanted, host, stopsStatus, stops]);
  useEffect(() => () => prefetchAbortRef.current?.abort(), []);

  // ---- Step transitions ----
  const advanceFrom = useCallback(
    (step: (typeof JOURNEY_STEPS)[number]) => {
      analytics.track('journey_step_completed', { slug, step });
      completeStep(slug, step);
    },
    [slug, completeStep],
  );
  /**
   * Hand off to the magic window at the viewpoint standing where the current
   * stop is heard. The two screens have been siblings with no link between them
   * since both were written; the visitor heard about the darbar hall and then
   * had to find it again in a list of eight place names.
   *
   * No extra gate: entry to this screen is already admin-only through
   * canBeginJourney, the same gate SiteDetail puts on the magic window.
   */
  const openReconstruction = useCallback(
    (viewpointId: string) => {
      navigation.navigate(ROUTES.MAIN.MAGIC_WINDOW, { slug, viewpointId });
    },
    [navigation, slug],
  );

  const finishJourney = useCallback(() => {
    advanceFrom('explore');
    setDone(true);
  }, [advanceFrom]);
  const handleStopChange = useCallback(
    (key: string) => setLastStopKey(slug, key),
    [slug, setLastStopKey],
  );
  const openVideo = useCallback(
    (uri: string, poster?: string) => setVideo({ uri, poster }),
    [],
  );

  /** ARCore is missing but the phone is capable — one tap from fixed. */
  const storeOpenedRef = useRef(false);
  const openArCoreInstall = useCallback(() => {
    storeOpenedRef.current = true;
    Linking.openURL('market://details?id=com.google.ar.core').catch(() =>
      Linking.openURL(
        'https://play.google.com/store/apps/details?id=com.google.ar.core',
      ).catch(() => {
        // Never leave the visitor on a screen whose primary button does nothing.
        storeOpenedRef.current = false;
        setCapabilityNoticeDone(true);
      }),
    );
  }, []);
  // Coming back from the Play Store: re-run the capability check so a finished
  // install is noticed without relaunching the app.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && storeOpenedRef.current) {
        storeOpenedRef.current = false;
        recheck();
      }
    });
    return () => sub.remove();
  }, [recheck]);

  // ======================= Render =======================

  // No journey authored for this venue — a different condition from "your
  // phone can't do AR", so it gets its own words.
  if (!host) {
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={[journeyStyles.title, styles.centerText]}>{t('journey.noHost.title')}</Text>
          <Text style={[journeyStyles.body, styles.centerText]}>{t('journey.noHost.body')}</Text>
          <GhostButton label={t('common.close')} onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  // Families-policy gate: FIRST, before any camera, permission or data gate,
  // so it is reachable off-site. Nothing below mounts until "I understand".
  if (!acknowledged) {
    return (
      <ARSafetyNotice
        onAcknowledge={() => setAcknowledged(true)}
        onExit={leave}
      />
    );
  }

  // GEOFENCE REFUSAL. After the safety notice (families policy is always first) and
  // before anything that spends the visitor's time or data: no pre-cache, no audio
  // fetch, no camera. 'checking' renders the same quiet frame as hydration, so the
  // screen never flashes a refusal at someone standing at the gates waiting for a fix.
  if (journeyGate.state === 'checking') {
    return <View style={journeyStyles.root} />;
  }
  if (!journeyGate.allowed) {
    const unavailable = journeyGate.state === 'unavailable';
    const km =
      journeyGate.distanceM != null
        ? Math.max(1, Math.round(journeyGate.distanceM / 1000))
        : null;
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={[journeyStyles.title, styles.centerText]}>
            {t(
              unavailable
                ? 'journey.gate.unavailableTitle'
                : 'journey.gate.outsideTitle',
            )}
          </Text>
          <Text style={[journeyStyles.body, styles.centerText]}>
            {t(
              unavailable
                ? 'journey.gate.unavailableBody'
                : 'journey.gate.outsideBody',
            )}
          </Text>
          {!unavailable && km != null ? (
            <Text style={[journeyStyles.body, styles.centerText]}>
              {t('journey.gate.outsideDistance', { km })}
            </Text>
          ) : null}
          <View style={journeyStyles.buttonRow}>
            <PrimaryButton
              label={t('journey.gate.retry')}
              onPress={journeyGate.refresh}
            />
            <GhostButton label={t('common.close')} onPress={leave} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!hydrated || resumeOffer === 'pending') {
    return <View style={journeyStyles.root} />;
  }

  if (resumeOffer === 'shown') {
    const complete = isJourneyComplete(progress);
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={journeyStyles.eyebrow}>{t('journey.steps.arrival').toUpperCase()}</Text>
          <Text style={[journeyStyles.title, styles.centerText]}>{t('journey.resume.title')}</Text>
          <Text style={[journeyStyles.body, styles.centerText]}>
            {t('journey.resume.body', {
              n: stepIndex + 1,
              title: t(`journey.steps.${stepId}`),
            })}
          </Text>
          <View style={journeyStyles.buttonRow}>
            {!complete ? (
              <PrimaryButton
                label={t('journey.resume.continue')}
                onPress={() => setResumeOffer('decided')}
              />
            ) : null}
            <GhostButton
              label={t('journey.resume.restart')}
              onPress={() => {
                resetProgress(slug);
                setResumeOffer('decided');
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (capability === 'checking') {
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={journeyStyles.caption}>{t('arCapability.checkingBody')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // This phone cannot do world-locked AR. Say so once, then carry on: the host
  // speaks without appearing and the audio guide is the same; only the
  // point-and-learn step is out of reach.
  if (nonAr && !capabilityNoticeDone) {
    const fixable = capability === 'arcore-missing';
    return (
      <ARCapabilityNotice
        capability={capability}
        intent="detect"
        onPrimary={fixable ? openArCoreInstall : () => setCapabilityNoticeDone(true)}
        onSecondary={fixable ? () => setCapabilityNoticeDone(true) : undefined}
        onExit={leave}
      />
    );
  }

  if (done) {
    return (
      <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={journeyStyles.eyebrow}>{t('journey.explore.eyebrow')}</Text>
          <Text style={[journeyStyles.title, styles.centerText]}>{t('journey.explore.done.title')}</Text>
          <Text style={[journeyStyles.body, styles.centerText]}>{t('journey.explore.done.body')}</Text>
          <PrimaryButton label={t('journey.explore.done.close')} onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  // The OS camera prompt is up: show nothing behind it rather than a gate that
  // would flash "Allow camera" under the dialog asking the same thing.
  if (arCapable && camera === 'unknown') {
    return <View style={journeyStyles.root} />;
  }
  const cameraGranted = camera === 'granted';

  let step: React.ReactNode;
  switch (stepId) {
    case 'arrival':
      step = (
        <LawnStep
          slug={slug}
          host={host}
          arCapable={arCapable}
          cameraGranted={cameraGranted}
          onRequestCamera={requestCamera}
          onSpeaking={wantPrefetch}
          prefetch={prefetch}
          onContinue={() => advanceFrom('arrival')}
        />
      );
      break;
    case 'prepare':
      step = (
        <PromptStep
          prefetch={prefetch}
          prefetchDone={prefetchDone}
          onContinue={() => advanceFrom('prepare')}
        />
      );
      break;
    case 'guide':
      step = (
        <AudioGuideStep
          status={stopsStatus}
          stops={stops}
          onRetry={() => void loadStops()}
          initialStopKey={progress.lastStopKey}
          onStopChange={handleStopChange}
          onOpenReconstruction={openReconstruction}
          onContinue={() => advanceFrom('guide')}
        />
      );
      break;
    case 'explore':
    default:
      step = (
        <PointLearnStep
          slug={slug}
          arCapable={arCapable}
          cameraGranted={cameraGranted}
          onRequestCamera={requestCamera}
          onOpenVideo={openVideo}
          onFinish={finishJourney}
        />
      );
      break;
  }

  return (
    <View style={journeyStyles.root}>
      {step}
      {/* ADMIN BYPASS BANNER. The geofence let this session through only because the
          account is on the admin allowlist. Saying so, permanently and on top of
          everything, is the difference between a deliberate off-site test and an
          admin quietly exercising a gate that has been broken for weeks. */}
      {journeyGate.state === 'bypass' ? (
        <View pointerEvents="none" style={styles.devBanner}>
          <Text style={styles.devBannerText}>{t('journey.gate.devBanner')}</Text>
        </View>
      ) : null}
      <JourneyTopBar
        stepIndex={stepIndex}
        onClose={confirmLeave}
        onBack={stepIndex > 0 ? goPrevious : undefined}
      />
      {video ? (
        <FullscreenVideo uri={video.uri} poster={video.poster} onClose={() => setVideo(null)} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  centerText: { textAlign: 'center' },
  devBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: 'rgba(201,168,76,0.92)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  devBannerText: {
    color: '#0A0A0C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default PalaceJourneyScreen;
