import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  MessageSquare,
  Sparkles,
  Shield,
} from 'lucide-react-native';
import { useUser } from '../../context';
import { useExplorerPass } from '../../shared/hooks';
import {
  getPersonalizedFacts,
  elaboratePersonalizedFact,
} from '../../utils/api/user';
import type { PersonalizedFact } from '../../utils/api/user';
import { getSite } from '../../utils/api/places';
import type { SiteDetail } from '../../utils/api/places';
import { ROUTES } from '../../core/constants';
import type { MainScreenProps } from '../../core/types/navigation.types';

const { height: SCREEN_H } = Dimensions.get('window');
// Figma "Site Details" (238:33) hero is 484 of a 977px frame ≈ 0.5 of height.
const HERO_HEIGHT = Math.round(SCREEN_H * 0.52);

const FACT_LOADING_LINES = [
  'Reading the stones...',
  'Uncovering connections...',
  'Weaving the narrative...',
];

type Props = MainScreenProps<'SiteDetail'>;

const SiteDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const site = route.params.site;
  const insets = useSafeAreaInsets();
  const profile = useUser(state => state.profile);
  const { checkAccess } = useExplorerPass();

  const scrollRef = useRef<ScrollView>(null);
  const overviewY = useRef(0);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const [facts, setFacts] = useState<PersonalizedFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(true);
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null);
  const [elaboratingFactId, setElaboratingFactId] = useState<string | null>(
    null,
  );

  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);

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
    return [site.city, site.country].filter(Boolean).join(', ') || 'India';
  }, [site, siteDetail]);

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
      `Explore ${site.name}, a historic heritage site located at ${location}.`
    );
  }, [site, siteDetail, location]);

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

  const handleStartARExperience = useCallback(() => {
    const monumentId = siteDetail?.slug ?? site.id;
    const siteName = siteDetail?.name ?? site.name;
    navigation.navigate(ROUTES.MAIN.AR_3D_VIEWER, {
      monumentId,
      objectLabel: siteName,
      glbUrl: '',
      siteName,
    });
  }, [navigation, siteDetail, site]);

  // "Learn About It" → reveal the full narrative and scroll to it.
  const handleLearnMore = useCallback(() => {
    setIsDescriptionExpanded(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(overviewY.current - 16, 0),
        animated: true,
      });
    });
  }, []);

  const handleGetPassport = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE, {
      preSelectedPlaceId: site.id,
    });
  }, [navigation, site.id]);

  // "Ask about this site" — open the AI Guide chat for this monument.
  const handleAskGuide = useCallback(() => {
    const guideSlug = siteDetail?.slug ?? site.id;
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
    <View className="flex-1 bg-warm-deep">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Full-bleed hero (Figma 238:61) */}
        <View style={{ height: HERO_HEIGHT }}>
          {siteDetail?.hero_image_url ? (
            <Image
              source={{ uri: siteDetail.hero_image_url }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#1A1410', '#0F0A05']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          )}

          {/* Soft blend into the page background at the bottom edge. */}
          <LinearGradient
            colors={['transparent', 'rgba(15,10,5,0.85)', '#0F0A05']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }}
          />

          {/* Back button — kept for usability (Figma omits it; swipe-back works). */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ top: insets.top + 8 }}
            className="absolute left-5 w-10 h-10 rounded-full bg-black/45 border border-white/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft color="#F5F0E8" size={20} />
          </TouchableOpacity>

          {/* AR Ready badge (Figma 238:63) — faithful pink/red, shown when ar_ready. */}
          {arReady && (
            <View
              style={{ top: insets.top + 10 }}
              className="absolute self-center rounded-[15px] bg-arready-bg px-4 py-1"
            >
              <Text className="text-arready-fg text-[11px] tracking-[0.4px] font-['MontserratAlternates-SemiBold']">
                AR Ready
              </Text>
            </View>
          )}
        </View>

        {/* Title (Figma 238:62) */}
        <Text className="text-parchment text-[40px] leading-[44px] text-center mt-3 px-6 font-['InstrumentSerif-Regular']">
          {site.name}
        </Text>

        {/* BUILT / DYNASTY cards (Figma 238:65 / 238:68) */}
        {(builtValue || dynastyValue) && (
          <View className="flex-row gap-3 px-5 mt-5">
            {builtValue && (
              <View className="flex-1 bg-cream border border-cream-border rounded-[10px] px-3.5 py-3">
                <Text className="text-stone-label text-[9px] tracking-[0.9px] font-['InstrumentSans-Bold']">
                  BUILT
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-stone-ink text-[24px] leading-[30px] mt-0.5 font-['InstrumentSerif-Regular']"
                >
                  {builtValue}
                </Text>
              </View>
            )}
            {dynastyValue && (
              <View className="flex-1 bg-cream border border-cream-border rounded-[10px] px-3.5 py-3">
                <Text className="text-stone-label text-[9px] tracking-[0.9px] font-['InstrumentSans-Bold']">
                  DYNASTY
                </Text>
                <Text
                  numberOfLines={1}
                  className="text-stone-ink text-[22px] leading-[28px] mt-0.5 font-['InstrumentSerif-Regular']"
                >
                  {dynastyValue}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Italic tagline (Figma 238:71) */}
        {tagline && (
          <Text className="text-stone-desc text-[18px] leading-[24px] text-center px-7 mt-5 font-['InstrumentSerif-Italic']">
            {tagline}
          </Text>
        )}

        {/* CTAs (Figma 238:72 / 238:75) */}
        <View className="px-7 mt-7 gap-3.5">
          <TouchableOpacity
            onPress={handleStartARExperience}
            activeOpacity={0.9}
            className="h-[53px] rounded-[30px] bg-terracotta flex-row items-center justify-center gap-2"
            accessibilityRole="button"
            accessibilityLabel="View in AR"
          >
            <Camera color="#FFFFFF" size={18} />
            <Text className="text-white text-[22px] font-['InstrumentSerif-Regular']">
              View in AR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLearnMore}
            activeOpacity={0.85}
            className="h-[53px] rounded-[30px] bg-peach border border-terracotta items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Learn About It"
          >
            <Text className="text-terracotta text-[22px] font-['InstrumentSerif-Regular']">
              Learn About It
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
              <Text className="text-status-success text-sm font-['InstrumentSans-SemiBold']">
                Passport Active
              </Text>
            </Animated.View>
          )}

          {/* Historical Overview */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(400)}
            onLayout={e => {
              overviewY.current = e.nativeEvent.layout.y;
            }}
            className="rounded-2xl bg-surface-1 border border-white/[0.08] p-4"
          >
            <Text className="text-parchment text-lg font-['InstrumentSans-SemiBold'] mb-2">
              Historical Overview
            </Text>
            <Text
              className="text-parchment-muted text-sm leading-[22px] font-['InstrumentSans-Regular']"
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
                <Text className="text-terracotta text-xs uppercase tracking-[0.8px] font-['InstrumentSans-SemiBold']">
                  {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                </Text>
                {isDescriptionExpanded ? (
                  <ChevronUp color="#B8551A" size={16} />
                ) : (
                  <ChevronDown color="#B8551A" size={16} />
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
                <View className="self-start rounded-full bg-[rgba(184,85,26,0.18)] px-2.5 py-1">
                  <Text className="text-terracotta text-[11px] uppercase tracking-[0.6px] font-['InstrumentSans-SemiBold']">
                    {siteDetail.unesco_status}
                  </Text>
                </View>
              )}

              <View className="flex-row flex-wrap">
                {(
                  [
                    ['Era', siteDetail.era],
                    ['Dynasty', siteDetail.dynasty],
                    ['Founder', siteDetail.founder],
                    ['Deity', siteDetail.deity],
                    ['Style', siteDetail.architectural_style],
                  ] as Array<[string, string | undefined]>
                )
                  .filter(([, value]) => Boolean(value))
                  .map(([label, value]) => (
                    <View key={label} className="w-1/2 pr-2 mb-3">
                      <Text className="text-parchment-dim text-[10px] uppercase tracking-[0.8px] font-['InstrumentSans-SemiBold']">
                        {label}
                      </Text>
                      <Text className="text-parchment text-[13px] leading-[18px] mt-0.5 font-['InstrumentSans-Medium']">
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
              <Sparkles color="#C9A84C" size={18} />
              <Text className="text-parchment text-lg font-['InstrumentSans-SemiBold']">
                Insights
              </Text>
            </View>

            {factsLoading ? (
              <View className="rounded-2xl bg-surface-1 border border-white/[0.08] p-5 items-center">
                <ThinkingDots messages={FACT_LOADING_LINES} color="#C9A84C" />
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
                    className="w-[240px] rounded-2xl bg-surface-1 border border-[rgba(184,85,26,0.28)] p-3.5"
                  >
                    <Text className="text-parchment text-[15px] leading-[22px] font-['InstrumentSans-SemiBold'] mb-1.5">
                      {fact.headline}
                    </Text>
                    <Text className="text-parchment-muted text-[13px] leading-[18px] font-['InstrumentSans-Regular']">
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
                          <Text className="text-brand-goldSoft text-[13px] leading-[20px] font-['InstrumentSans-Regular']">
                            {fact.detail}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    <Text className="text-terracotta text-[11px] mt-2 font-['InstrumentSans-SemiBold']">
                      {expandedFactId === fact.id ? 'Collapse' : 'Learn more'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View className="rounded-2xl bg-surface-1 border border-white/[0.08] p-4">
                <Text className="text-parchment-dim text-sm text-center font-['InstrumentSans-Regular']">
                  Insights will appear as you explore nearby monuments
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Ask about this site (AI Guide) */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity
              onPress={handleAskGuide}
              className="rounded-xl bg-surface-1 border border-terracotta/40 py-3 items-center justify-center flex-row gap-2"
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ask about this site"
            >
              <MessageSquare color="#B8551A" size={16} />
              <Text className="text-terracotta text-[14px] tracking-[0.4px] font-['InstrumentSans-SemiBold']">
                Ask about this site
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Get Passport — hidden when the user already has access */}
          {!hasAccess && (
            <Animated.View entering={FadeInDown.delay(340).duration(400)}>
              <TouchableOpacity
                onPress={handleGetPassport}
                className="flex-row items-center justify-center gap-1.5 py-2"
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Get Passport for this site"
              >
                <Sparkles color="#C9A84C" size={14} />
                <Text className="text-brand-gold text-[13px] font-['InstrumentSans-SemiBold']">
                  Get Passport for this site
                </Text>
                <ChevronRight color="#C9A84C" size={14} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default SiteDetailScreen;
