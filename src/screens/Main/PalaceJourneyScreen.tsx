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
 * the leave/back handling. Each step owns its
 * own native AR view so the session is torn down between steps.
 *
 * Back handling: every affordance — the X, the back chevron, the Android
 * hardware button — goes through useSafeBackHandler so exiting can never fall
 * through to closing the app. Hardware back steps
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
import { useSiteGate } from '../../shared/hooks/useSiteGate';
import { hasMagicWindow } from '../../features/magicwindow/scenes';
import { listViewingStations } from '../../utils/api/ar';
import LawnStep from './journey/LawnStep';
import PromptStep from './journey/PromptStep';
import AudioGuideStep, { type StopsStatus } from './journey/AudioGuideStep';
import SitePaywallSheet from '../Lens/components/SitePaywallSheet';
import { getExplorerPassQuote } from '../../utils/api/explorer-pass';
import { siteTelemetry } from '../../services/siteTelemetry';
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

  // GEOFENCE. Entry is refused off-site, which also closes the deep-link route into
  // the journey (a link reaches this screen without ever passing the Site Detail CTA).
  // Admins get state 'bypass' and a standing banner rather than a silent pass.
  const siteGate = useSiteGate(slug);

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
    // The full-screen video branch that used to sit here went with 'explore':
    // PointLearnStep's card videos were the only thing that ever opened one, so
    // with that step out of the sequence nothing in the journey can.
    //
    // Gates and the finish screen exit directly; only a live step is a place
    // worth guarding.
    if (!acknowledged || resumeOffer === 'shown' || done) return false;
    if (stepIndex > 0) {
      goPrevious();
      return true;
    }
    confirmLeave();
    return true;
  }, [acknowledged, resumeOffer, done, stepIndex, goPrevious, confirmLeave]);
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
  /**
   * The purchase sheet for a locked stop.
   *
   * Opened from AudioGuideStep, never by it: the sheet is a modal over the whole
   * screen and the step does not own the screen. On a verified purchase the
   * stops are RE-FETCHED rather than patched locally — the server is the only
   * thing that knows the clips, because it stripped them, so re-asking is the
   * only way to get them and the only way that cannot disagree with entitlement.
   */
  /**
   * ONE SESSION FOR THE WHOLE JOURNEY, not one per AR step.
   *
   * The lawn, the scan and the guide are three surfaces of one visit to one
   * building, and the numbers we want out of them — how dark it was, how often
   * tracking gave up, how hot the phone got — are properties of that visit. Three
   * summaries would have to be stitched back together by whoever reads them, and
   * a visitor who backs out of one step would look like a separate visit.
   */
  useEffect(() => {
    siteTelemetry.beginSession(slug, 'journey');
    return () => siteTelemetry.endSession();
  }, [slug]);

  const [paywallOpen, setPaywallOpen] = useState(false);

  /**
   * The price to SHOW, fetched rather than written down.
   *
   * /quote is region-aware and resolves the per-place override server-side, so
   * hardcoding "₹200" here would be wrong for a foreign visitor and would go
   * stale the day an admin retunes the price. Display only either way — the
   * charge is locked at /initiate and re-verified at /confirm, so a wrong label
   * here cannot become a wrong charge.
   *
   * Fetched lazily, when the sheet is first opened: nobody who never hits a
   * locked stop should cost a round trip. Null simply omits the price block.
   */
  const [priceLabel, setPriceLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!paywallOpen || priceLabel !== null) return;
    let alive = true;
    void getExplorerPassQuote([slug]).then(res => {
      if (!alive || !res.success) return;
      const paise = res.data.total_paise;
      if (typeof paise !== 'number') return;
      // Always rupees: the quote carries no currency because Razorpay charges in
      // INR for both regions — "foreign" selects a different rupee price
      // (explorer_pass_config.default_price_paise_foreign), not a different unit.
      setPriceLabel(`₹${Math.round(paise / 100)}`);
    });
    return () => {
      alive = false;
    };
  }, [paywallOpen, priceLabel, slug]);

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
   * THIS GATE USED TO BE INHERITED, AND THAT WAS THE BUG. The previous comment
   * here read "no extra gate: entry to this screen is already admin-only
   * through canBeginJourney, the same gate SiteDetail puts on the magic
   * window." That was true, load-bearing, and written down nowhere else — so
   * flipping JOURNEY_OPEN_TO_ALL to open the JOURNEY would silently have opened
   * the MAGIC WINDOW too. Keeping the two decisions separate was right and
   * stays right; what was wrong was the decision the separate gate then made.
   *
   * IT WAS `isAdminUser(email)`, AND THAT WAS BACKWARDS. This single boolean
   * hid all five palace figures, every figure card, Purnaiah's five recorded
   * lines and the reconstruction button on all eight stops — from the only
   * people who could possibly be standing in the building. Three accounts saw
   * the reconstruction from an office; a visitor in the courtyard saw none of
   * it. The DISPUTED facade length (satellite 33.5 m, OSM 35.1 m, photographs
   * 29-33 m, deliberately not averaged) is a reason to caption the model
   * honestly, which it does — every material name carries its tier — not a
   * reason to show it only to people who cannot check it against the wall.
   *
   * SO IT IS PLACE, NOT ROLE: `siteGate.allowed` is 'inside' OR 'bypass', i.e.
   * `atVenue || isAdminUser`. Admin remains the OFF-SITE TEST BYPASS.
   *
   * `hasMagicWindow(slug)` STAYS, and is a different kind of check. It asks
   * whether anything has been BUILT for this venue. Standing at a site with no
   * reconstruction must still show nothing, however present the visitor is.
   *
   * In practice the gate term is always true here: the screen already returns
   * the refusal card at `!siteGate.allowed` below, so by this line the visitor
   * is inside or bypassing. It is written out anyway rather than dropped,
   * because the next person to move this line must not have to rediscover that
   * the guarantee comes from somewhere else.
   */
  const magicWindowAllowed = hasMagicWindow(slug) && siteGate.allowed;
  /**
   * The guide chat, from anywhere in the journey.
   *
   * It lost its own button when SiteDetail collapsed to one call to action, and
   * a chat about a monument is worth most while the visitor is standing in
   * front of it — not back on a menu two taps away. `step` rides along on the
   * existing ai_guide_opened event so it stays one series while gaining the
   * ability to say where the question was asked from.
   */
  /**
   * Authored viewing stations for this venue, so the arrival step can offer the
   * world-locked reconstruction. Fetched once; a failure leaves it false and
   * the control simply does not appear, which is the same outcome as a site
   * with no stations and needs no separate message.
   */
  const [hasStations, setHasStations] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void listViewingStations(slug).then(res => {
      if (!cancelled && res.success) {
        setHasStations((res.data.stations ?? []).length > 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  const openReconstructionStations = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.AR_CAPABILITY, {
      intent: 'reconstruction',
      venueSlug: slug,
      siteName: host?.siteName,
    });
  }, [navigation, slug, host]);

  const openAsk = useCallback(() => {
    analytics.track('ai_guide_opened', { slug, step: JOURNEY_STEPS[stepIndex] });
    navigation.navigate(ROUTES.MAIN.AI_GUIDE, {
      slug,
      siteName: host?.siteName ?? slug,
    });
  }, [navigation, slug, stepIndex, host]);

  const openReconstruction = useCallback(
    (viewpointId: string) => {
      if (!magicWindowAllowed) return;
      navigation.navigate(ROUTES.MAIN.MAGIC_WINDOW, { slug, viewpointId });
    },
    [navigation, slug, magicWindowAllowed],
  );

  /**
   * The camera wipe on a stop's restored view.
   *
   * `imageUrl` arrives already resolved, exactly as the route type asks
   * (navigation.types.ts) and exactly as AudioGuideScreen has always passed it —
   * the step owns the resolution because the step owns the stop.
   *
   * NOT gated on magicWindowAllowed. That gate protects the whole reconstructed
   * building; this is one image with its own authored provenance caption, and it
   * has been reachable from the standalone audio screen from the day it shipped.
   */
  const openRestoration = useCallback(
    (args: { imageUrl: string; caption?: string; title: string }) => {
      navigation.navigate(ROUTES.MAIN.RESTORATION, {
        imageUrl: args.imageUrl,
        caption: args.caption,
        title: args.title,
        siteName: host?.siteName ?? slug,
      });
    },
    [navigation, host, slug],
  );

  /**
   * The end of the journey.
   *
   * Completes 'guide', not 'explore'. With 'explore' gone from JOURNEY_STEPS,
   * `completeStep('explore')` computes clampStep(indexOf(...) + 1) =
   * clampStep(0) and would send a visitor who just finished back to the lawn,
   * while `isStepId` quietly dropped 'explore' from completedSteps so nothing
   * recorded the finish either.
   */
  const finishJourney = useCallback(() => {
    advanceFrom('guide');
    setDone(true);
  }, [advanceFrom]);
  const handleStopChange = useCallback(
    (key: string) => setLastStopKey(slug, key),
    [slug, setLastStopKey],
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
  if (siteGate.state === 'checking') {
    return <View style={journeyStyles.root} />;
  }
  if (!siteGate.allowed) {
    const unavailable = siteGate.state === 'unavailable';
    const km =
      siteGate.distanceM != null
        ? Math.max(1, Math.round(siteGate.distanceM / 1000))
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
              onPress={siteGate.refresh}
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
          {/* NOT `journey.explore.eyebrow`, which reads "POINT AND LEARN".
              That named the step this screen used to follow, and point-and-learn
              left the journey sequence — so the finish screen was announcing a
              step the visitor had never been shown. The key itself stays:
              PointLearnStep still uses it, and there it is still true. */}
          <Text style={journeyStyles.eyebrow}>{t('journey.explore.done.eyebrow')}</Text>
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
          onOpenReconstruction={
            hasStations && arCapable ? openReconstructionStations : undefined
          }
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
    default:
      // THE LAST STEP NOW. `onContinue` is `finishJourney` rather than an
      // advance into a fourth step that no longer exists — completing 'guide'
      // can no longer move the index, so without this the visitor is parked on
      // the final audio stop with the top-bar X as the only way out.
      step = (
        <AudioGuideStep
          status={stopsStatus}
          stops={stops}
          onRetry={() => void loadStops()}
          initialStopKey={progress.lastStopKey}
          onStopChange={handleStopChange}
          onOpenReconstruction={
            magicWindowAllowed ? openReconstruction : undefined
          }
          // NOT GATED, unlike the reconstruction above. This is one image with
          // its own provenance caption, and the standalone audio screen has
          // offered the same wipe to anyone who could open it since it shipped;
          // gating it only inside the journey would make the guided door the
          // poorer one.
          onOpenRestoration={openRestoration}
          onContinue={finishJourney}
          onUnlock={() => setPaywallOpen(true)}
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
      {siteGate.state === 'bypass' ? (
        <View pointerEvents="none" style={styles.devBanner}>
          <Text style={styles.devBannerText}>{t('journey.gate.devBanner')}</Text>
        </View>
      ) : null}
      <JourneyTopBar
        stepIndex={stepIndex}
        onClose={confirmLeave}
        onBack={stepIndex > 0 ? goPrevious : undefined}
        onAsk={openAsk}
      />
      {/* One sheet for the whole journey, mounted here rather than inside the
          guide step so it survives a step change mid-purchase. `reasonLine`
          overrides its default copy: the visitor hit the guide's preview limit,
          not a scan limit, and telling them they used up scans would name a
          wall they never touched. */}
      <SitePaywallSheet
        visible={paywallOpen}
        siteId={slug}
        siteName={host?.siteName}
        priceLabel={priceLabel ?? undefined}
        reasonLine={t('journey.guide.lockedReason', {
          free: stops?.free_preview_stops ?? 0,
        })}
        onClose={() => setPaywallOpen(false)}
        onUnlocked={() => void loadStops()}
      />
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
