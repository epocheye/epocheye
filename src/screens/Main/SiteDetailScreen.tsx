import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import ThinkingDots from '../../components/ui/ThinkingDots';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  Footprints,
  Headphones,
  Share2,
  Sparkles,
  Shield,
} from 'lucide-react-native';
import ShareExperienceModal from '../../components/ShareExperienceModal';
import { TourTarget } from '../../components/tour/useTourTarget';
import { useUser } from '../../context';
import { useExplorerPass } from '../../shared/hooks';
import {
  getPersonalizedFacts,
  elaboratePersonalizedFact,
} from '../../utils/api/user';
import type { PersonalizedFact } from '../../utils/api/user';
import { getSite } from '../../utils/api/places';
import type { SiteDetail } from '../../utils/api/places';
import { resolveSiteImageSource } from '../../shared/utils/localSiteImages';
import { moderateScale } from '../../utils/scaling';
import { isAdminUser } from '../../shared/auth/isAdminUser';
import { isMagicWindowAvailable } from '../../native/EpocheyeMagicWindowView';
import { MAGIC_WINDOW_SLUG } from '../../features/magicwindow/viewpoints';
import { ROUTES } from '../../core/constants';
import { listViewingStations } from '../../utils/api/ar';
import { getAudioStops } from '../../utils/api/audio';
import { shouldShowAudioCta } from '../../shared/utils/audioGuide';
import {
  useMuseumPrefsStore,
  useNarrationLang,
} from '../../stores/museumPrefsStore';
import { useVenueGate } from '../../shared/hooks/useVenueGate';
import { useIsAdmin } from '../../shared/hooks/useIsAdmin';
import { analytics } from '../../services/analytics';
import { canBeginJourney } from './journey/journeyConfig';
import { useJourneyGate } from './journey/useJourneyGate';
import type {
  MainScreenProps,
  PlaceNavParam,
} from '../../core/types/navigation.types';

const { height: SCREEN_H } = Dimensions.get('window');
// Figma "Site Details" (238:33) hero is 484 of a 977px frame ≈ 0.5 of height.
const HERO_HEIGHT = Math.round(SCREEN_H * 0.52);

type Props = MainScreenProps<'SiteDetail'>;

const SiteDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();

  const FACT_LOADING_LINES = useMemo(
    () => [
      t('siteDetail.factLoading.readingStones'),
      t('siteDetail.factLoading.uncoveringConnections'),
      t('siteDetail.factLoading.weavingNarrative'),
    ],
    [t],
  );
  // Normal navigation passes `site`; a deep link (epocheye://site/<slug>) passes
  // only `slug` — synthesize a minimal param so the slug-keyed `getSite` lookup runs.
  const site = useMemo<PlaceNavParam>(
    () =>
      route.params.site ?? {id: route.params.slug ?? '', name: ''},
    [route.params.site, route.params.slug],
  );
  const insets = useSafeAreaInsets();
  const profile = useUser(state => state.profile);
  const { checkAccess } = useExplorerPass();

  const scrollRef = useRef<ScrollView>(null);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [facts, setFacts] = useState<PersonalizedFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(true);
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null);
  const [elaboratingFactId, setElaboratingFactId] = useState<string | null>(
    null,
  );

  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);

  // Hero title: prefer the loaded record, then the nav param, then a readable
  // fallback derived from the slug — a deep-linked site has an empty `site.name`
  // until `getSite` resolves, which otherwise renders a blank title.
  const heroTitle = useMemo(() => {
    const resolved = siteDetail?.name?.trim() || site.name?.trim();
    if (resolved) return resolved;
    const slug = (route.params.slug ?? site.id ?? '').trim();
    if (slug) {
      return slug
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
    return t('siteDetail.untitled');
  }, [siteDetail?.name, site.name, site.id, route.params.slug, t]);

  // Tracks a hero image that failed to load (e.g. a stale/404 hero_image_url) so
  // we can fall back to the gradient instead of showing a blank box. Reset per site.
  const [heroFailed, setHeroFailed] = useState(false);
  useEffect(() => {
    setHeroFailed(false);
  }, [siteDetail?.hero_image_url]);

  // Prefer a bundled local hero (instant/offline) over the remote hero_image_url.
  const heroSource = useMemo(
    () => (siteDetail ? resolveSiteImageSource(siteDetail) : null),
    [siteDetail],
  );

  const location = useMemo(() => {
    if (siteDetail) {
      const parts = [
        siteDetail.district,
        siteDetail.state,
        siteDetail.country,
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
    const formatted = (site as any).formatted;
    if (typeof formatted === 'string' && formatted.length > 0) {
      return formatted;
    }
    return (
      [site.city, site.country].filter(Boolean).join(', ') ||
      t('siteDetail.defaultCountry')
    );
  }, [site, siteDetail, t]);

  // Figma "BUILT" + "DYNASTY" stat cards. Each renders only when it has a value.
  const builtValue = useMemo(
    () => siteDetail?.century ?? siteDetail?.era ?? null,
    [siteDetail],
  );
  const dynastyValue = useMemo(() => siteDetail?.dynasty ?? null, [siteDetail]);

  // Italic tagline under the title (Figma 238:71).
  const tagline = useMemo(() => {
    return (
      siteDetail?.one_line_description ??
      siteDetail?.short_description ??
      (site as any).significance ??
      null
    );
  }, [site, siteDetail]);

  // Longer narrative revealed by "Learn About It" / "Read More".
  const description = useMemo(() => {
    if (siteDetail?.short_description) {
      return siteDetail.short_description;
    }
    const desc = (site as any).description;
    const sig = (site as any).significance;
    return (
      desc ||
      sig ||
      t('siteDetail.fallbackDescription', {name: site.name, location})
    );
  }, [site, siteDetail, location, t]);

  const arReady = Boolean(siteDetail?.ar_ready);

  useEffect(() => {
    checkAccess(site.id).then(result => {
      if (result?.has_access) {
        setHasAccess(true);
      }
    });
  }, [checkAccess, site.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      const result = await getSite(site.id);
      if (cancelled) {
        return;
      }
      if (result.success) {
        setSiteDetail(result.data);
      } else {
        // 404 is expected for places that exist in /findplaces (Geoapify) but
        // haven't been curated into the monuments table yet. Leave siteDetail
        // null and fall back to route-param data.
        setSiteDetail(null);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [site.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadFacts() {
      setFactsLoading(true);
      const result = await getPersonalizedFacts({
        userName: profile?.name ?? 'Explorer',
        nearbyPlaces: [site.name],
        limit: 4,
      });
      if (!cancelled) {
        if (result.success) {
          setFacts(result.data.facts);
        }
        setFactsLoading(false);
      }
    }

    loadFacts();
    return () => {
      cancelled = true;
    };
  }, [site.name, profile?.name]);

  // "View in AR" → open the live Lens camera in museum mode. When the site is
  // not AR-ready, the Lens screen shows an "AR not available yet" notice and
  // falls back to object detection with 3D anchored labels identifying the site.
  const handleStartARExperience = useCallback(() => {
    const slug = siteDetail?.slug ?? site.id;
    // Single AR surface: the detector→grounded-card→AR flow (DetectARScreen).
    // It runs the agent recognizer for the venue and is gated by useVenueGate.
    navigation.navigate(ROUTES.MAIN.AR_CAPABILITY, {
      intent: 'detect',
      venueSlug: slug,
    });
  }, [navigation, siteDetail, site]);

  // Site-readiness: surface the guided reconstruction CTA only when an admin has
  // authored at least one viewing station for this site.
  const [hasReconstruction, setHasReconstruction] = useState(false);
  useEffect(() => {
    const slug = siteDetail?.slug ?? site.id;
    if (!slug) {
      return;
    }
    let cancelled = false;
    void listViewingStations(slug).then(res => {
      if (!cancelled && res.success) {
        setHasReconstruction((res.data.stations ?? []).length > 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [siteDetail?.slug, site.id]);
  const handleReconstruction = useCallback(() => {
    const slug = siteDetail?.slug ?? site.id;
    navigation.navigate(ROUTES.MAIN.AR_CAPABILITY, {
      intent: 'reconstruction',
      venueSlug: slug,
      siteName: siteDetail?.name ?? undefined,
    });
  }, [navigation, siteDetail, site]);

  // Guided journey: shown only where a journey is authored AND, while
  // JOURNEY_OPEN_TO_ALL is false, only to the admin allowlist. The email is
  // read from the reactive profile so the CTA appears once it finishes loading.
  const journeySlug = siteDetail?.slug ?? site.id;
  const showJourney = canBeginJourney(journeySlug, profile?.email);
  // GEOFENCE. A site journey is something you do AT the site, so the CTA is inert
  // off-site — the same rule DetectArScreen states for production scanning. The
  // hook answers 'bypass' (never 'inside') for the admin allowlist so an admin can
  // still reach it, and the journey screen itself shows a standing banner saying so.
  const journeyGate = useJourneyGate(showJourney ? journeySlug : null);
  const handleBeginJourney = useCallback(() => {
    if (!journeyGate.allowed) return;
    analytics.track('journey_cta_tapped', {
      slug: journeySlug,
      gate: journeyGate.state,
    });
    navigation.navigate(ROUTES.MAIN.PALACE_JOURNEY, {slug: journeySlug});
  }, [navigation, journeySlug, journeyGate.allowed, journeyGate.state]);

  // MAGIC WINDOW — camera off, gyroscope drives the view.
  //
  // Admin-gated, and NOT geofenced. Both are deliberate:
  //  * Not geofenced, because the whole point is that it needs no site. Every AR
  //    route at Bangalore Fort failed on the evidence — the breach sits in a bus
  //    yard behind a treeline, the scan has no metric scale, no ground anchor
  //    exists — and a magic window needs none of that. Gating it to the site
  //    would re-impose the constraint it was built to escape.
  //  * Admin-gated, because the reconstruction still carries an unresolved
  //    evidence dispute: this circuit is ~7% smaller than the enceinte already
  //    live on CloudFront, so the product would otherwise show two Bangalore
  //    Forts of different sizes. Open it up once that is settled.
  const magicWindowSlug = siteDetail?.slug ?? site.id;
  const showMagicWindow =
    magicWindowSlug === MAGIC_WINDOW_SLUG &&
    isMagicWindowAvailable &&
    isAdminUser(profile?.email);
  const handleMagicWindow = useCallback(() => {
    analytics.track('magic_window_opened', {slug: magicWindowSlug});
    navigation.navigate(ROUTES.MAIN.MAGIC_WINDOW);
  }, [navigation, magicWindowSlug]);

  // Audio guide: probe for stops the same way hasReconstruction probes for
  // viewing stations. The CTA is on-site only (the guide is meant to be walked),
  // with an admin bypass so the screen is reachable for testing from anywhere.
  const audioLang = useNarrationLang();
  const audioPersona = useMuseumPrefsStore(s => s.narrationPersona);
  const {inVenue, venueSlug: activeVenueSlug} = useVenueGate();
  const isAdminClaim = useIsAdmin();
  const [hasAudioGuide, setHasAudioGuide] = useState(false);
  useEffect(() => {
    const slug = siteDetail?.slug ?? site.id;
    if (!slug) {
      return;
    }
    let cancelled = false;
    void getAudioStops(slug, audioLang, audioPersona).then(res => {
      if (!cancelled && res.success) {
        setHasAudioGuide((res.data.stops ?? []).length > 0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [siteDetail?.slug, site.id, audioLang, audioPersona]);

  // ADMIN-HARNESS (REMOVE AFTER KONARK) — accept EITHER admin signal: the
  // is_admin JWT claim or the ADMIN_EMAILS allowlist. They are separate
  // mechanisms and only one may apply to a given test account. Neither is a
  // security boundary — /api/v1/audio/stops is plain user-auth and returns the
  // same data to everyone — so this only decides who sees the button.
  const audioAdminBypass = isAdminClaim || isAdminUser(profile?.email);
  const showAudioCta = shouldShowAudioCta({
    hasStops: hasAudioGuide,
    atThisVenue:
      inVenue && !!activeVenueSlug &&
      activeVenueSlug === (siteDetail?.slug ?? site.id),
    adminBypass: audioAdminBypass,
  });
  const handleAudioGuide = useCallback(() => {
    const slug = siteDetail?.slug ?? site.id;
    navigation.navigate(ROUTES.MAIN.AUDIO_GUIDE, {
      venueSlug: slug,
      siteName: siteDetail?.name ?? site.name,
    });
  }, [navigation, siteDetail, site]);

  // Record a site view once per opened site (the auto screen_view carries no slug).
  useEffect(() => {
    analytics.track('site_viewed', {slug: site.id});
  }, [site.id]);

  const handleGetPassport = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE, {
      preSelectedPlaceId: site.id,
    });
  }, [navigation, site.id]);

  // "Ask about this site" — open the AI Guide chat for this monument.
  const handleAskGuide = useCallback(() => {
    const guideSlug = siteDetail?.slug ?? site.id;
    analytics.track('ai_guide_opened', {slug: guideSlug});
    navigation.navigate(ROUTES.MAIN.AI_GUIDE, {
      slug: guideSlug,
      siteName: siteDetail?.name ?? site.name,
      heroImageUrl: siteDetail?.hero_image_url,
    });
  }, [navigation, siteDetail, site.id, site.name]);

  const handleElaborateFact = useCallback(
    async (fact: PersonalizedFact) => {
      if (expandedFactId === fact.id && fact.detail) {
        setExpandedFactId(null);
        return;
      }

      setExpandedFactId(fact.id);

      if (fact.detail) {
        return;
      }

      setElaboratingFactId(fact.id);
      const result = await elaboratePersonalizedFact({
        factId: fact.id,
        headline: fact.headline,
        summary: fact.summary,
        userName: profile?.name,
        nearbyPlaceName: site.name,
      });

      if (result.success) {
        setFacts(prev =>
          prev.map(f =>
            f.id === fact.id ? { ...f, detail: result.data.detail } : f,
          ),
        );
      }
      setElaboratingFactId(null);
    },
    [expandedFactId, profile?.name, site.name],
  );

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" translucent />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Full-bleed hero (Figma 238:61) */}
        <View style={{ height: HERO_HEIGHT, overflow: 'hidden' }}>
          {heroSource && !heroFailed ? (
            <Image
              source={heroSource}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
              onError={() => setHeroFailed(true)}
            />
          ) : (
            <LinearGradient
              colors={['#16151C', '#0A0A0C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          )}

          {/* Soft blend into the page background at the bottom edge. */}
          <LinearGradient
            colors={['transparent', 'rgba(10,10,12,0.85)', '#0A0A0C']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }}
          />

          {/* Back button — kept for usability (Figma omits it; swipe-back works). */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ top: insets.top + 8 }}
            className="absolute left-5 w-10 h-10 rounded-full bg-black/45 border border-white/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('siteDetail.back')}
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>

          {/* Share this site — mirrors the back button at top-right. */}
          <TouchableOpacity
            onPress={() => setShareOpen(true)}
            style={{ top: insets.top + 8 }}
            className="absolute right-5 w-10 h-10 rounded-full bg-black/45 border border-white/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('siteDetail.shareSite')}
          >
            <Share2 color="#F5F0E8" size={18} />
          </TouchableOpacity>

          {/* AR Ready badge (Figma 238:63) — faithful pink/red, shown when ar_ready. */}
          {arReady && (
            <View
              style={{ top: insets.top + 10, borderRadius: moderateScale(15) }}
              className="absolute self-center bg-[rgba(203,168,98,0.16)] border border-[rgba(203,168,98,0.4)] px-4 py-1"
            >
              <Text className="text-brand-gold text-[11px] tracking-[0.4px] font-ui-medium">
                {t('siteDetail.arReady')}
              </Text>
            </View>
          )}
        </View>

        {/* Title (Figma 238:62) */}
        <Text
          className="text-parchment text-center mt-3 px-6 font-display"
          style={{fontSize: moderateScale(40), lineHeight: moderateScale(44)}}>
          {heroTitle}
        </Text>

        {/* BUILT / DYNASTY cards (Figma 238:65 / 238:68) */}
        {(builtValue || dynastyValue) && (
          <View className="flex-row gap-3 px-5 mt-5">
            {builtValue && (
              <View
                className="flex-1 bg-surface-1 border border-white/10 px-3.5 py-3"
                style={{borderRadius: moderateScale(10)}}>
                <Text className="text-parchment-dim text-[9px] tracking-[0.9px] font-ui-semibold">
                  {t('siteDetail.builtLabel')}
                </Text>
                <Text
                  // Two lines, not one. These cards are half the screen wide and
                  // the values are real prose — "18th century", "Kingdom of
                  // Mysore" — which cannot fit on one line at display size on any
                  // normal handset, so a single line simply clipped them to "…".
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  className="text-parchment mt-0.5 font-display"
                  style={{fontSize: moderateScale(18), lineHeight: moderateScale(22)}}
                >
                  {builtValue}
                </Text>
              </View>
            )}
            {dynastyValue && (
              <View
                className="flex-1 bg-surface-1 border border-white/10 px-3.5 py-3"
                style={{borderRadius: moderateScale(10)}}>
                <Text className="text-parchment-dim text-[9px] tracking-[0.9px] font-ui-semibold">
                  {t('siteDetail.dynastyLabel')}
                </Text>
                <Text
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  className="text-parchment mt-0.5 font-display"
                  style={{fontSize: moderateScale(18), lineHeight: moderateScale(22)}}
                >
                  {dynastyValue}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Italic tagline (Figma 238:71) */}
        {tagline && (
          <Text
            className="text-parchment-muted text-center px-7 mt-5 italic font-display-regular"
            style={{fontSize: moderateScale(18), lineHeight: moderateScale(24)}}>
            {tagline}
          </Text>
        )}

        {/* CTAs (Figma 238:72 / 238:75) */}
        <View className="px-7 mt-7 gap-3.5">
          <TourTarget id="siteDetail.viewAr">
            <TouchableOpacity
              onPress={handleStartARExperience}
              activeOpacity={0.9}
              className="bg-brand-gold flex-row items-center justify-center gap-2"
              style={{height: moderateScale(53), borderRadius: moderateScale(30)}}
              accessibilityRole="button"
              accessibilityLabel={t('siteDetail.viewInAr')}
            >
              <Camera color="#0A0A0C" size={18} />
              <Text className="text-ink font-display" style={{fontSize: moderateScale(22)}}>
                {t('siteDetail.viewInAr')}
              </Text>
            </TouchableOpacity>
          </TourTarget>

          {showJourney && (
            <TouchableOpacity
              onPress={handleBeginJourney}
              activeOpacity={journeyGate.allowed ? 0.9 : 1}
              disabled={!journeyGate.allowed}
              className="flex-row items-center justify-center gap-2"
              style={{
                height: moderateScale(53),
                borderRadius: moderateScale(30),
                borderWidth: 1,
                borderColor: '#C9A84C',
                // Dimmed rather than hidden: a visitor reading about the palace at
                // home should see that this exists and that it happens on site.
                opacity: journeyGate.allowed ? 1 : 0.45,
              }}
              accessibilityRole="button"
              accessibilityState={{disabled: !journeyGate.allowed}}
              accessibilityLabel={
                journeyGate.allowed
                  ? t('journey.cta')
                  : t('journey.gate.outsideCta')
              }
              accessibilityHint={
                journeyGate.allowed ? t('journey.ctaHint') : undefined
              }>
              <Footprints color="#CBA862" size={18} />
              <Text
                className="text-brand-gold font-display"
                style={{fontSize: moderateScale(20)}}>
                {journeyGate.allowed
                  ? t('journey.cta')
                  : journeyGate.state === 'checking'
                    ? t('journey.gate.checking')
                    : t('journey.gate.outsideCta')}
              </Text>
            </TouchableOpacity>
          )}

          {showMagicWindow && (
            <TouchableOpacity
              onPress={handleMagicWindow}
              activeOpacity={0.9}
              className="flex-row items-center justify-center gap-2"
              style={{
                height: moderateScale(53),
                borderRadius: moderateScale(30),
                borderWidth: 1,
                borderColor: '#C9A84C',
              }}
              accessibilityRole="button"
              accessibilityLabel="See it as it stood, 1791">
              <Eye color="#CBA862" size={18} />
              <Text
                className="text-brand-gold font-display"
                style={{fontSize: moderateScale(20)}}>
                See it as it stood, 1791
              </Text>
            </TouchableOpacity>
          )}

          {hasReconstruction && (
            <TouchableOpacity
              onPress={handleReconstruction}
              activeOpacity={0.9}
              className="flex-row items-center justify-center gap-2"
              style={{
                height: moderateScale(53),
                borderRadius: moderateScale(30),
                borderWidth: 1,
                borderColor: '#C9A84C',
              }}
              accessibilityRole="button"
              accessibilityLabel="See the reconstruction">
              <Text
                className="text-brand-gold font-display"
                style={{fontSize: moderateScale(20)}}>
                See the reconstruction
              </Text>
            </TouchableOpacity>
          )}

          {showAudioCta && (
            <TouchableOpacity
              onPress={handleAudioGuide}
              activeOpacity={0.9}
              className="flex-row items-center justify-center gap-2"
              style={{
                height: moderateScale(53),
                borderRadius: moderateScale(30),
                borderWidth: 1,
                borderColor: '#C9A84C',
              }}
              accessibilityRole="button"
              accessibilityLabel={t('audioGuide.listenCta')}>
              <Headphones color="#C9A84C" size={18} />
              <Text
                className="text-brand-gold font-display"
                style={{fontSize: moderateScale(20)}}>
                {t('audioGuide.listenCta')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleAskGuide}
            activeOpacity={0.85}
            className="bg-surface-1 border border-white/12 items-center justify-center"
            style={{height: moderateScale(53), borderRadius: moderateScale(30)}}
            accessibilityRole="button"
            accessibilityLabel={t('siteDetail.learnAboutIt')}
          >
            <Text className="text-brand-gold font-display" style={{fontSize: moderateScale(22)}}>
              {t('siteDetail.learnAboutIt')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---- Kept functional sections (restyled onto warm-dark) ---- */}
        <View className="px-5 mt-8 gap-4">
          {/* Passport badge */}
          {hasAccess && (
            <Animated.View
              entering={FadeIn.delay(120)}
              className="flex-row items-center gap-2 bg-status-success/10 border border-status-success/20 rounded-xl px-4 py-3"
            >
              <Shield color="#10B981" size={16} />
              <Text className="text-status-success text-sm font-ui-semibold">
                {t('siteDetail.passportActive')}
              </Text>
            </Animated.View>
          )}

          {/* Historical Overview */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(400)}
            className="rounded-2xl bg-surface-1 border border-white/[0.08] p-4"
          >
            <Text className="text-parchment text-lg font-ui-semibold mb-2">
              {t('siteDetail.historicalOverview')}
            </Text>
            <Text
              className="text-parchment-muted text-sm leading-[22px] font-ui"
              numberOfLines={isDescriptionExpanded ? undefined : 3}
            >
              {description}
            </Text>
            {description.length > 120 && (
              <TouchableOpacity
                onPress={() => setIsDescriptionExpanded(prev => !prev)}
                className="mt-2.5 flex-row items-center gap-1 self-start"
                accessibilityRole="button"
              >
                <Text className="text-brand-gold text-xs uppercase tracking-[0.8px] font-ui-semibold">
                  {isDescriptionExpanded
                    ? t('siteDetail.showLess')
                    : t('siteDetail.readMore')}
                </Text>
                {isDescriptionExpanded ? (
                  <ChevronUp color="#CBA862" size={16} />
                ) : (
                  <ChevronDown color="#CBA862" size={16} />
                )}
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Heritage Details — curated DB record */}
          {siteDetail && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="rounded-2xl bg-surface-1 border border-white/[0.08] p-4 gap-3"
            >
              {siteDetail.unesco_status && (
                <View className="self-start rounded-full bg-[rgba(203,168,98,0.18)] px-2.5 py-1">
                  <Text className="text-brand-gold text-[11px] uppercase tracking-[0.6px] font-ui-semibold">
                    {siteDetail.unesco_status}
                  </Text>
                </View>
              )}

              <View className="flex-row flex-wrap">
                {(
                  [
                    ['era', t('siteDetail.detailEra'), siteDetail.era],
                    ['dynasty', t('siteDetail.detailDynasty'), siteDetail.dynasty],
                    ['founder', t('siteDetail.detailFounder'), siteDetail.founder],
                    ['deity', t('siteDetail.detailDeity'), siteDetail.deity],
                    [
                      'style',
                      t('siteDetail.detailStyle'),
                      siteDetail.architectural_style,
                    ],
                  ] as Array<[string, string, string | undefined]>
                )
                  .filter(([, , value]) => Boolean(value))
                  .map(([key, label, value]) => (
                    <View key={key} className="w-1/2 pr-2 mb-3">
                      <Text className="text-parchment-dim text-[10px] uppercase tracking-[0.8px] font-ui-semibold">
                        {label}
                      </Text>
                      <Text className="text-parchment text-[13px] leading-[18px] mt-0.5 font-ui-medium">
                        {value}
                      </Text>
                    </View>
                  ))}
              </View>
            </Animated.View>
          )}

          {/* Personalized Insights */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <View className="flex-row items-center gap-1.5 mb-3">
              <Sparkles color="#CBA862" size={18} />
              <Text className="text-parchment text-lg font-ui-semibold">
                {t('siteDetail.insights')}
              </Text>
            </View>

            {factsLoading ? (
              <View className="rounded-2xl bg-surface-1 border border-white/[0.08] p-5 items-center">
                <ThinkingDots messages={FACT_LOADING_LINES} color="#CBA862" />
              </View>
            ) : facts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 20, gap: 12 }}
              >
                {facts.map(fact => (
                  <TouchableOpacity
                    key={fact.id}
                    onPress={() => handleElaborateFact(fact)}
                    activeOpacity={0.86}
                    className="w-[240px] rounded-2xl bg-surface-1 border border-[rgba(203,168,98,0.28)] p-3.5"
                  >
                    <Text className="text-parchment text-[15px] leading-[22px] font-ui-semibold mb-1.5">
                      {fact.headline}
                    </Text>
                    <Text className="text-parchment-muted text-[13px] leading-[18px] font-ui">
                      {fact.summary}
                    </Text>

                    {expandedFactId === fact.id && (
                      <View className="mt-3 pt-3 border-t border-white/[0.08]">
                        {elaboratingFactId === fact.id ? (
                          <View className="items-center py-2">
                            <AnimatedLogo
                              size={16}
                              variant="white"
                              motion="pulse"
                              showRing={false}
                            />
                          </View>
                        ) : fact.detail ? (
                          <Text className="text-brand-goldSoft text-[13px] leading-[20px] font-ui">
                            {fact.detail}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    <Text className="text-brand-gold text-[11px] mt-2 font-ui-semibold">
                      {expandedFactId === fact.id
                        ? t('siteDetail.collapse')
                        : t('siteDetail.learnMore')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View className="rounded-2xl bg-surface-1 border border-white/[0.08] p-4">
                <Text className="text-parchment-dim text-sm text-center font-ui">
                  {t('siteDetail.insightsEmpty')}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Get Passport — hidden when the user already has access */}
          {!hasAccess && (
            <Animated.View entering={FadeInDown.delay(340).duration(400)}>
              <TouchableOpacity
                onPress={handleGetPassport}
                className="flex-row items-center justify-center gap-1.5 py-2"
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('siteDetail.getPassport')}
              >
                <Sparkles color="#CBA862" size={14} />
                <Text className="text-brand-gold text-[13px] font-ui-semibold">
                  {t('siteDetail.getPassport')}
                </Text>
                <ChevronRight color="#CBA862" size={14} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <ShareExperienceModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        siteSlug={siteDetail?.slug ?? site.id}
        title={siteDetail?.name ?? site.name}
        imageUrl={siteDetail?.hero_image_url ?? undefined}
      />
    </View>
  );
};

export default SiteDetailScreen;
