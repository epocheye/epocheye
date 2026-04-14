/**
 * ARExperienceScreen
 *
 * Monument-specific AR experience that extends the Lens pipeline.
 * Receives a site via route params and provides:
 * - Live VisionCamera feed with segmentation overlay
 * - Gemini-powered object identification
 * - Geofence-aware AR anchoring (ARCore on Android)
 * - Historical timeline from personalized facts API
 * - HD scan for premium users
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  ScanEye,
  Sparkles,
  X,
} from 'lucide-react-native';

import { useGeminiIdentification } from '../../shared/hooks/useGeminiIdentification';
import { useARCore } from '../../shared/hooks/useARCore';
import { getActiveZone } from '../../services/geofenceService';
import { fetchZones } from '../../services/zoneService';
import { getPersonalizedFacts } from '../../utils/api/user';
import type { PersonalizedFact } from '../../utils/api/user';
import { useUser } from '../../context';
import { performHDScan, type HDScanMask } from '../../services/hdScanService';
import { getValidAccessToken } from '../../utils/api/auth';
import { trackUsageEvent } from '../../services/usageTelemetryService';
import { ROUTES } from '../../core/constants';
import type { MainScreenProps } from '../../core/types/navigation.types';
import type { HeritageZone } from '../../core/config/geofence.types';

import EpocheyeARView from '../../native/EpocheyeARView';
import IdentificationCard from '../Lens/components/IdentificationCard';
import HDScanOverlay from '../Lens/components/HDScanOverlay';

type Props = MainScreenProps<'ARExperience'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ARExperienceScreen: React.FC<Props> = ({ navigation, route }) => {
  const site = route.params.site;
  const insets = useSafeAreaInsets();
  const profile = useUser(state => state.profile);
  const cameraRef = useRef<VisionCamera | null>(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { arAvailable } = useARCore();

  // Geofence state
  const [activeZone, setActiveZone] = useState<HeritageZone | null>(null);

  // Timeline state
  const [timelineFacts, setTimelineFacts] = useState<PersonalizedFact[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const timelineHeight = useSharedValue(100);

  // HD scan state
  const [hdMasks, setHdMasks] = useState<HDScanMask[]>([]);
  const [hdScanLoading, setHdScanLoading] = useState(false);

  // Info modal
  const [showInfo, setShowInfo] = useState(false);

  // Gemini identification hook
  const {
    result: geminiResult,
    loading: geminiLoading,
    error: geminiError,
    isOfflineResult,
    identify,
    dismiss: dismissIdentification,
    canIdentify,
    canShowMask,
    canShowDetails,
    remainingCalls,
  } = useGeminiIdentification({
    siteHint: site.name,
    zoneId: activeZone?.id,
  });

  // Check geofence on mount
  useEffect(() => {
    void fetchZones();

    if (site.lat != null && site.lon != null) {
      const zone = getActiveZone(site.lat, site.lon);
      setActiveZone(zone);
    }
  }, [site.lat, site.lon]);

  // Request permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch(() => {});
    }
  }, [hasPermission, requestPermission]);

  // Load timeline facts
  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      setTimelineLoading(true);
      const result = await getPersonalizedFacts({
        userName: profile?.name ?? 'Explorer',
        nearbyPlaces: [site.name],
        limit: 5,
      });
      if (!cancelled && result.success) {
        setTimelineFacts(result.data.facts);
      }
      if (!cancelled) {
        setTimelineLoading(false);
      }
    }

    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [site.name, profile?.name]);

  const handleIdentify = useCallback(async () => {
    if (!canIdentify) {
      navigation.navigate(ROUTES.MAIN.PURCHASE);
      return;
    }
    await identify(cameraRef);
  }, [canIdentify, identify, navigation]);

  const handleExpandIdentification = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.SITE_DETAIL, { site });
  }, [navigation, site]);

  const handleUpgradePremium = useCallback(() => {
    navigation.navigate(ROUTES.MAIN.PURCHASE);
  }, [navigation]);

  const handleHDScan = useCallback(async () => {
    if (hdScanLoading) {
      return;
    }
    if (!canShowMask) {
      navigation.navigate(ROUTES.MAIN.PURCHASE);
      return;
    }

    setHdScanLoading(true);
    setHdMasks([]);

    try {
      const photo = await cameraRef.current?.takePhoto();
      if (!photo) {
        throw new Error('Photo capture failed');
      }
      const token = await getValidAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const result = await performHDScan(photo.path, token);
      if (result.success && result.masks.length > 0) {
        setHdMasks(result.masks);
        trackUsageEvent('hd_scan', activeZone?.id);
      }
    } catch {
      // Silent — HD scan failures don't show errors to user
    } finally {
      setHdScanLoading(false);
    }
  }, [hdScanLoading, canShowMask, activeZone?.id, navigation]);

  const handleTimelineToggle = useCallback(() => {
    const toValue = timelineExpanded ? 100 : 380;
    timelineHeight.value = withSpring(toValue, {
      damping: 20,
      stiffness: 180,
    });
    setTimelineExpanded(prev => !prev);
  }, [timelineExpanded, timelineHeight]);

  const timelineAnimStyle = useAnimatedStyle(() => ({
    height: timelineHeight.value,
  }));

  // ── Permission fallback ──────────────────────────────────────────
  if (!hasPermission) {
    return (
      <GestureHandlerRootView className="flex-1">
        <SafeAreaView className="flex-1 bg-[#000000] items-center justify-center px-8">
          <Camera color="#D4860A" size={56} />
          <Text className="text-[#F5F0E8] text-xl text-center font-['MontserratAlternates-Bold'] mt-6 mb-2">
            Camera access needed
          </Text>
          <Text className="text-[#B8AF9E] text-sm text-center font-['MontserratAlternates-Regular'] mb-8 leading-5">
            Allow camera access to explore {site.name} through augmented
            reality.
          </Text>
          <Pressable
            onPress={() => requestPermission().catch(() => {})}
            className="w-full bg-[#C9A84C] rounded-xl py-3.5 items-center mb-3"
          >
            <Text className="text-[#0A0A0A] text-base font-['MontserratAlternates-Bold']">
              Grant Camera Access
            </Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openSettings().catch(() => {})}
            className="w-full bg-[#141414] border border-white/10 rounded-xl py-3.5 items-center mb-3"
          >
            <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-Medium']">
              Open Settings
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} className="mt-2">
            <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Medium']">
              Back
            </Text>
          </Pressable>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // ── Main AR view ─────────────────────────────────────────────────
  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-[#000000]">
        {/* Camera layer */}
        {device && (
          <VisionCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            photo
          />
        )}

        {/* AR overlay — native ARCore view if available + has identification */}
        {arAvailable && geminiResult && (
          <EpocheyeARView
            style={StyleSheet.absoluteFill}
            identification={geminiResult}
            arEnabled
            onCardTapped={handleExpandIdentification}
            onARError={() => {}}
          />
        )}

        {/* HD Scan overlay */}
        {hdMasks.length > 0 && (
          <HDScanOverlay
            masks={hdMasks}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
          />
        )}

        {/* Subtle amber AR tint */}
        <View
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(212,134,10,0.06)' }}
          pointerEvents="none"
        />

        {/* Corner bracket markers */}
        {[
          { top: insets.top + 70, left: 24 },
          { top: insets.top + 70, right: 24 },
          { bottom: 420, left: 24 },
          { bottom: 420, right: 24 },
        ].map((pos, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                width: 22,
                height: 22,
                borderColor: 'rgba(212,134,10,0.6)',
                borderTopWidth: i < 2 ? 2 : 0,
                borderBottomWidth: i >= 2 ? 2 : 0,
                borderLeftWidth: i % 2 === 0 ? 2 : 0,
                borderRightWidth: i % 2 === 1 ? 2 : 0,
              },
              pos as any,
            ]}
          />
        ))}

        {/* "AR Active" / "AR coming soon" badge */}
        <SafeAreaView
          className="absolute top-0 left-0 right-0"
          pointerEvents="none"
        >
          <View className="items-center mt-16">
            <View className="flex-row items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5 border border-[rgba(212,134,10,0.3)]">
              {arAvailable ? (
                <>
                  <View className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <Text className="text-[#10B981] text-[11px] font-['MontserratAlternates-SemiBold']">
                    AR Active
                  </Text>
                </>
              ) : (
                <>
                  <Sparkles color="#D4860A" size={11} />
                  <Text className="text-[#D4860A] text-[11px] font-['MontserratAlternates-Medium']">
                    Live AR launching soon
                  </Text>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>

        {/* Top controls */}
        <SafeAreaView className="absolute top-0 left-0 right-0">
          <View className="flex-row items-center justify-between px-5 py-4">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
            >
              <ArrowLeft color="#FFFFFF" size={22} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowInfo(true)}
              className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
            >
              <HelpCircle color="#FFFFFF" size={22} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Monument name overlay */}
        <View className="absolute left-5 right-5" style={{ top: insets.top + 80 }}>
          <View className="bg-black/60 rounded-2xl p-4">
            <Text className="text-[#F5F0E8] text-xl font-['MontserratAlternates-Bold']">
              {site.name}
            </Text>
            <Text className="text-[#D4860A] text-sm font-['MontserratAlternates-SemiBold'] mt-1">
              Heritage Monument
            </Text>
          </View>
        </View>

        {/* Identification Card — shown when Gemini has a result, is loading, or has error */}
        {(geminiResult || geminiLoading || geminiError) && !arAvailable && (
          <View className="absolute left-5 right-5" style={{ top: insets.top + 170 }}>
            <IdentificationCard
              identification={geminiResult}
              isLoading={geminiLoading}
              error={geminiError}
              isPremium={canShowDetails}
              isOffline={isOfflineResult}
              onDismiss={dismissIdentification}
              onExpand={handleExpandIdentification}
              onUpgrade={handleUpgradePremium}
            />
          </View>
        )}

        {/* Object Identification action button */}
        <View className="absolute left-5 right-5 bottom-[210px]">
          <TouchableOpacity
            onPress={handleIdentify}
            activeOpacity={0.88}
            className="bg-[#12121A]/90 rounded-2xl p-4 border border-[#272730] flex-row items-center gap-3"
          >
            <View className="w-10 h-10 rounded-full bg-[#D4860A]/15 items-center justify-center">
              <ScanEye color="#D4860A" size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-SemiBold']">
                Identify Object
              </Text>
              <Text
                className="text-[#8D8D92] text-xs font-['MontserratAlternates-Regular'] mt-0.5"
                numberOfLines={1}
              >
                {geminiLoading
                  ? 'Identifying...'
                  : `Point camera at an artifact (${remainingCalls} left today)`}
              </Text>
            </View>
            {canShowMask && (
              <TouchableOpacity
                onPress={handleHDScan}
                className="bg-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-full px-2.5 py-1"
              >
                <Text className="text-[#C9A84C] text-[10px] font-['MontserratAlternates-SemiBold']">
                  {hdScanLoading ? '...' : 'HD Scan'}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* Timeline Drawer */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(12, 12, 18, 0.97)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: '#272730',
              overflow: 'hidden',
            },
            timelineAnimStyle,
          ]}
        >
          {/* Drag handle + title */}
          <TouchableOpacity
            onPress={handleTimelineToggle}
            className="items-center pt-3 pb-2"
            accessibilityRole="button"
            accessibilityLabel={
              timelineExpanded ? 'Collapse timeline' : 'Expand timeline'
            }
          >
            <View className="w-9 h-1 rounded-full bg-[#3A3A44] mb-3" />
            <View className="flex-row items-center justify-between w-full px-5">
              <View className="flex-row items-center gap-2">
                <Clock color="#D4860A" size={16} />
                <Text className="text-[#F5F0E8] text-base font-['MontserratAlternates-SemiBold']">
                  Historical Insights
                </Text>
              </View>
              {timelineExpanded ? (
                <ChevronDown color="#6B6357" size={18} />
              ) : (
                <ChevronUp color="#6B6357" size={18} />
              )}
            </View>
          </TouchableOpacity>

          {/* Timeline content */}
          {timelineExpanded && (
            <Animated.ScrollView
              entering={FadeIn.duration(300)}
              className="flex-1 px-5 pb-5"
              showsVerticalScrollIndicator={false}
            >
              {timelineLoading ? (
                <View className="py-4 items-center">
                  <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Regular']">
                    Loading insights...
                  </Text>
                </View>
              ) : timelineFacts.length > 0 ? (
                timelineFacts.map((fact, index) => (
                  <Animated.View
                    key={fact.id}
                    entering={FadeInDown.delay(index * 80).duration(300)}
                    className="flex-row items-start mb-4"
                  >
                    {/* Vertical connector */}
                    <View className="items-center mr-3" style={{ width: 20 }}>
                      <View className="w-4 h-4 rounded-full bg-[#D4860A] items-center justify-center">
                        <View className="w-2 h-2 rounded-full bg-[#0A0A0A]" />
                      </View>
                      {index < timelineFacts.length - 1 && (
                        <View
                          className="w-0.5 flex-1 bg-[#272730] mt-1"
                          style={{ minHeight: 24 }}
                        />
                      )}
                    </View>
                    <View className="flex-1 pb-2">
                      <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-SemiBold']">
                        {fact.headline}
                      </Text>
                      <Text className="text-[#8D8D92] text-xs font-['MontserratAlternates-Regular'] mt-1 leading-4">
                        {fact.summary}
                      </Text>
                    </View>
                  </Animated.View>
                ))
              ) : (
                <View className="py-4 items-center">
                  <Text className="text-[#6B6357] text-sm font-['MontserratAlternates-Regular']">
                    No insights available for this monument yet
                  </Text>
                </View>
              )}
            </Animated.ScrollView>
          )}

          {/* Exit button */}
          {!timelineExpanded && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mx-5 mt-1 bg-[#1F1F2A] rounded-2xl py-3 items-center justify-center border border-[#272730]"
            >
              <Text className="text-white text-sm font-['MontserratAlternates-SemiBold']">
                Exit AR Experience
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Info Modal */}
        {showInfo && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="absolute inset-0 bg-black/70 items-center justify-center px-8"
          >
            <View className="bg-[#12121A] rounded-3xl p-6 w-full border border-[#272730]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-xl font-['MontserratAlternates-Bold']">
                  AR Experience Help
                </Text>
                <TouchableOpacity onPress={() => setShowInfo(false)}>
                  <X color="#8D8D92" size={24} />
                </TouchableOpacity>
              </View>
              <Text className="text-[#B4B4BA] text-base font-['MontserratAlternates-Regular'] leading-6">
                {'\u2022'} Tap "Identify Object" to scan artifacts with AI
                {'\n'}{'\u2022'} Swipe up the drawer for historical insights
                {'\n'}{'\u2022'} Premium users can use HD Scan for detailed segmentation
                {'\n'}{'\u2022'} {arAvailable
                  ? 'AR overlays are active — move your phone to explore'
                  : 'Full AR overlays coming in a future update'}
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

export default ARExperienceScreen;
