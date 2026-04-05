import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import Geolocation from '@react-native-community/geolocation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScanEye, X } from 'lucide-react-native';
import { track } from '../../services/analytics';
import { findPlaces, type Place } from '../../utils/api/places';
import { getFallbackStory } from '../../services/fallbackStories';
import {
  streamLensStory,
  type LensIdentifiedObject,
} from '../../services/lensStoryService';
import { usePlaces, useUser } from '../../context';
import { useOnboardingStore } from '../../stores/onboardingStore';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { FONTS } from '../../core/constants/theme';
import AncestorStorySheet, {
  type AncestorStorySheetRef,
} from './components/AncestorStorySheet';
import BottomCard, { type LensDetectionState } from './components/BottomCard';
import EpochChips from './components/EpochChips';
import MonumentInfoSheet, {
  type MonumentInfoSheetRef,
} from './components/MonumentInfoSheet';
import PulsingRing from './components/PulsingRing';
import SearchSheet, { type SearchSheetRef } from './components/SearchSheet';

type Props = MainScreenProps<'Lens'>;

type MatchResult =
  | { kind: 'matched'; place: Place }
  | { kind: 'not_found' }
  | { kind: 'denied' };

const SEARCH_RADII = [500, 1000, 2000] as const;
const MATCH_TIMEOUT_MS = 8000;

function normalizePhotoUri(path: string): string {
  if (path.startsWith('file://')) {
    return path;
  }
  return `file://${path}`;
}

async function findNearestPlace(
  latitude: number,
  longitude: number,
): Promise<Place | null> {
  for (const radius of SEARCH_RADII) {
    const result = await findPlaces({
      latitude,
      longitude,
      radius_meters: radius,
      limit: 1,
    });

    if (result.success && result.data.places.length > 0) {
      return result.data.places[0];
    }
  }

  return null;
}

const LensScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { profile } = useUser();
  const { nearbyPlaces } = usePlaces();
  const storeFirstName = useOnboardingStore(state => state.firstName);
  const storeMotivation = useOnboardingStore(state => state.motivation);
  const storeRegions = useOnboardingStore(state => state.regions);

  const { hasPermission, requestPermission } = useCameraPermission();
  const permissionRequestedRef = useRef(false);

  const cameraRef = useRef<VisionCamera | null>(null);
  const storySheetRef = useRef<AncestorStorySheetRef | null>(null);
  const infoSheetRef = useRef<MonumentInfoSheetRef | null>(null);
  const searchSheetRef = useRef<SearchSheetRef | null>(null);
  const storyAbortRef = useRef<(() => void) | null>(null);
  const notFoundTrackedRef = useRef(false);

  const device = useCameraDevice('back');

  const [state, setState] = useState<LensDetectionState>('searching');
  const [matchedPlace, setMatchedPlace] = useState<Place | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [showRing, setShowRing] = useState(true);
  const [ringMatched, setRingMatched] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyStreaming, setStoryStreaming] = useState(false);
  const [storyMode, setStoryMode] = useState<'monument' | 'object_scan'>(
    'monument',
  );
  const [identifiedObject, setIdentifiedObject] =
    useState<LensIdentifiedObject | null>(null);

  const firstName = useMemo(() => {
    const fromProfile = profile?.name?.trim();
    if (fromProfile && fromProfile.length > 0) {
      return fromProfile;
    }

    const fromStore = storeFirstName.trim();
    return fromStore.length > 0 ? fromStore : 'Explorer';
  }, [profile?.name, storeFirstName]);

  const regions = useMemo(
    () => (storeRegions.length > 0 ? storeRegions : ['South Asia']),
    [storeRegions],
  );

  const motivation = useMemo(
    () => storeMotivation ?? 'heritage_visitor',
    [storeMotivation],
  );

  const transitionToNotFound = useCallback((isLocationDenied: boolean) => {
    setState('not_found');
    setMatchedPlace(null);
    setLocationDenied(isLocationDenied);
    setShowRing(false);
    setRingMatched(false);

    if (!notFoundTrackedRef.current) {
      notFoundTrackedRef.current = true;
      track('lens_monument_not_found', {
        reason: isLocationDenied ? 'location_denied' : 'no_match',
      });
    }
  }, []);

  const detectMonument = useCallback(async (): Promise<MatchResult> => {
    return new Promise(resolve => {
      Geolocation.getCurrentPosition(
        async position => {
          try {
            const place = await findNearestPlace(
              position.coords.latitude,
              position.coords.longitude,
            );

            if (place) {
              resolve({ kind: 'matched', place });
              return;
            }

            resolve({ kind: 'not_found' });
          } catch {
            resolve({ kind: 'not_found' });
          }
        },
        error => {
          if (error.code === 1) {
            resolve({ kind: 'denied' });
            return;
          }
          resolve({ kind: 'not_found' });
        },
        {
          enableHighAccuracy: true,
          timeout: MATCH_TIMEOUT_MS,
          maximumAge: 0,
        },
      );
    });
  }, []);

  const runDetection = useCallback(async () => {
    setState('searching');
    setMatchedPlace(null);
    setLocationDenied(false);
    setShowRing(true);
    setRingMatched(false);
    notFoundTrackedRef.current = false;

    const result = await Promise.race<MatchResult | { kind: 'timeout' }>([
      detectMonument(),
      new Promise(resolve => {
        setTimeout(() => resolve({ kind: 'timeout' }), MATCH_TIMEOUT_MS);
      }),
    ]);

    if (result.kind === 'matched') {
      setMatchedPlace(result.place);
      setState('matched');
      setRingMatched(true);
      track('lens_monument_matched', { value: result.place.name });
      return;
    }

    if (result.kind === 'denied') {
      transitionToNotFound(true);
      return;
    }

    transitionToNotFound(false);
  }, [detectMonument, transitionToNotFound]);

  useEffect(() => {
    track('lens_opened');
  }, []);

  useEffect(() => {
    if (!hasPermission && !permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestPermission().catch(() => {
        // Permission request errors are handled by the fallback UI below.
      });
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    runDetection().catch(() => {
      transitionToNotFound(false);
    });
  }, [runDetection, transitionToNotFound]);

  useEffect(() => {
    return () => {
      storyAbortRef.current?.();
    };
  }, []);

  const handleOpenStory = useCallback(async () => {
    if (!matchedPlace) {
      return;
    }

    track('lens_story_opened', { value: matchedPlace.name });

    storyAbortRef.current?.();
    setStoryText('');
    setStoryLoading(true);
    setStoryStreaming(true);
    setStoryMode('monument');
    setIdentifiedObject(null);
    storySheetRef.current?.open();

    try {
      const photo = await cameraRef.current?.takePhoto();

      if (!photo) {
        throw new Error('Photo capture failed');
      }

      const imageUri = normalizePhotoUri(photo.path);

      storyAbortRef.current = streamLensStory({
        imageUri,
        monumentName: matchedPlace.name,
        firstName,
        regions,
        mode: 'monument',
        onChunk: chunk => {
          setStoryLoading(false);
          setStoryText(previous => previous + chunk);
        },
        onDone: monument => {
          setStoryLoading(false);
          setStoryStreaming(false);
          track('lens_story_generated', { value: monument });
        },
        onError: () => {
          setStoryLoading(false);
          setStoryStreaming(false);
        },
      });
    } catch {
      const fallback = getFallbackStory(regions[0] ?? 'South Asia', firstName);
      setStoryText(fallback.story);
      setStoryLoading(false);
      setStoryStreaming(false);
      track('lens_story_generated', {
        value: fallback.monument,
        source: 'fallback',
      });
    }
  }, [firstName, matchedPlace, regions]);

  const handleScanObject = useCallback(async () => {
    if (!matchedPlace) {
      return;
    }

    track('lens_object_scan_triggered', {
      monument: matchedPlace.name,
    });

    storyAbortRef.current?.();
    setStoryText('');
    setStoryLoading(true);
    setStoryStreaming(true);
    setStoryMode('object_scan');
    setIdentifiedObject(null);

    try {
      const photo = await cameraRef.current?.takePhoto();

      if (!photo) {
        throw new Error('Photo capture failed');
      }

      const imageUri = normalizePhotoUri(photo.path);
      storySheetRef.current?.open();

      storyAbortRef.current = streamLensStory({
        imageUri,
        monumentName: matchedPlace.name,
        firstName,
        regions,
        motivation,
        mode: 'object_scan',
        onChunk: chunk => {
          setStoryLoading(false);
          setStoryText(previous => previous + chunk);
        },
        onDone: (monument, object) => {
          setStoryLoading(false);
          setStoryStreaming(false);
          setIdentifiedObject(object ?? null);

          if (object) {
            track('lens_object_identified', {
              monument: matchedPlace.name,
              objectName: object?.name ?? 'unknown',
              confidence: 'from_done_event_if_available',
            });
          }

          track('lens_story_generated', {
            value: monument,
            mode: 'object_scan',
          });
        },
        onError: () => {
          setStoryLoading(false);
          setStoryStreaming(false);
        },
      });
    } catch {
      const fallback = getFallbackStory(regions[0] ?? 'South Asia', firstName);
      setStoryText(fallback.story);
      setStoryLoading(false);
      setStoryStreaming(false);
      setIdentifiedObject(null);
      storySheetRef.current?.open();
      track('lens_story_generated', {
        value: fallback.monument,
        source: 'fallback',
        mode: 'object_scan',
      });
    }
  }, [firstName, matchedPlace, motivation, regions]);

  const handleOpenInfo = useCallback(() => {
    if (!matchedPlace) {
      return;
    }
    track('lens_info_opened', { value: matchedPlace.name });
    infoSheetRef.current?.open();
  }, [matchedPlace]);

  const handleBrowseMonuments = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSearchManually = useCallback(() => {
    searchSheetRef.current?.open();
  }, []);

  const handleSelectPlace = useCallback((place: Place) => {
    setMatchedPlace(place);
    setState('matched');
    setLocationDenied(false);
    setShowRing(false);
    setRingMatched(false);
    track('lens_monument_matched', {
      value: place.name,
      source: 'manual_search',
    });
  }, []);

  const handleArTeaserSeen = useCallback(() => {
    track('lens_ar_teaser_seen', { value: matchedPlace?.name ?? 'unknown' });
  }, [matchedPlace?.name]);

  if (!hasPermission) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.permissionScreen}>
          <Text style={styles.permissionTitle}>
            Camera access is required for Lens.
          </Text>
          <Text style={styles.permissionBody}>
            Grant camera permission to identify nearby monuments and generate
            your ancestor story.
          </Text>

          <Pressable
            style={styles.permissionPrimaryButton}
            onPress={() => {
              requestPermission().catch(() => {
                // Best-effort prompt.
              });
            }}
          >
            <Text style={styles.permissionPrimaryText}>
              Grant Camera Access
            </Text>
          </Pressable>

          <Pressable
            style={styles.permissionSecondaryButton}
            onPress={() => {
              Linking.openSettings().catch(() => {
                // Best-effort deep link.
              });
            }}
          >
            <Text style={styles.permissionSecondaryText}>Open Settings</Text>
          </Pressable>

          <Pressable
            style={styles.closeLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeLinkText}>Back</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        {device ? (
          <VisionCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            photo
          />
        ) : (
          <View style={styles.noDeviceWrap}>
            <ScanEye size={38} color="#E8A020" />
            <Text style={styles.noDeviceText}>
              Camera device not available.
            </Text>
          </View>
        )}

        <View style={styles.cameraOverlay} />

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.topBarTitle}>LENS</Text>
          <Pressable
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Close Lens"
          >
            <X size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {showRing ? (
          <PulsingRing
            matched={ringMatched}
            onMatchAnimationComplete={() => {
              setShowRing(false);
            }}
          />
        ) : null}

        <EpochChips visible={state === 'matched'} onPress={handleOpenStory} />

        <BottomCard
          state={state}
          place={matchedPlace}
          locationDenied={locationDenied}
          onOpenStory={handleOpenStory}
          onOpenInfo={handleOpenInfo}
          onScanObject={handleScanObject}
          onBrowseMonuments={handleBrowseMonuments}
          onSearchManually={handleSearchManually}
        />

        <AncestorStorySheet
          ref={storySheetRef}
          monumentName={matchedPlace?.name ?? 'UNKNOWN MONUMENT'}
          firstName={firstName}
          storyText={storyText}
          isStreaming={storyStreaming}
          isLoading={storyLoading}
          mode={storyMode}
          identifiedObject={identifiedObject}
          onArTeaserSeen={handleArTeaserSeen}
        />

        <MonumentInfoSheet ref={infoSheetRef} place={matchedPlace} />

        <SearchSheet
          ref={searchSheetRef}
          places={nearbyPlaces}
          onSelectPlace={handleSelectPlace}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 4,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 3,
    fontFamily: FONTS.bold,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  noDeviceWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0D0D',
  },
  noDeviceText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
    fontFamily: FONTS.bold,
  },
  permissionBody: {
    color: '#8C93A0',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    fontFamily: FONTS.regular,
  },
  permissionPrimaryButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  permissionPrimaryText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  permissionSecondaryButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  permissionSecondaryText: {
    color: '#E8A020',
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },
  closeLink: {
    marginTop: 14,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeLinkText: {
    color: '#8C93A0',
    fontSize: 13,
    fontFamily: FONTS.regular,
  },
});

export default LensScreen;
