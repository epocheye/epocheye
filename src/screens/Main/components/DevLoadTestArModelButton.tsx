/**
 * DEV-only triggers for the AR experience.
 *
 * Two rows, both gated on `__DEV__`:
 *  - "Test AR Model" → opens the viewer with the Khronos Duck (pipeline check).
 *  - "Konark Shell"  → opens the viewer on the default-monument route so the
 *                      "coming soon" empty state and era slider are testable
 *                      without a backend. Real eras flow from
 *                      `site.content.ar_data` via useActiveMonument when
 *                      filled in the backend.
 *
 * Compiles to a no-op in production builds.
 */

import React, {useCallback} from 'react';
import {Pressable, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ROUTES} from '../../../core/constants';
import type {MainStackParamList} from '../../../core/types/navigation.types';
import {DEV_MONUMENT_ID} from './eraModels';
import {DEFAULT_MONUMENT_SLUG} from '../../../config/monuments';

const KHRONOS_DUCK_URL =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';

const DevLoadTestArModelButton: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const handleLoadDuck = useCallback(() => {
    console.log('[DevLoadTestArModel] nav to Ar3dViewer with', KHRONOS_DUCK_URL);
    navigation.navigate(ROUTES.MAIN.AR_3D_VIEWER, {
      monumentId: DEV_MONUMENT_ID,
      objectLabel: 'Duck',
      glbUrl: KHRONOS_DUCK_URL,
      knowledgeText:
        'Khronos sample asset used to verify the AR rendering pipeline before real monument models are hosted.',
    });
  }, [navigation]);

  const handleKonarkShell = useCallback(() => {
    console.log('[DevLoadTestArModel] nav to Ar3dViewer with default-monument shell');
    navigation.navigate(ROUTES.MAIN.AR_3D_VIEWER, {
      monumentId: DEFAULT_MONUMENT_SLUG,
      objectLabel: 'shell',
      // glbUrl is required by the route param shape but Ar3dViewerScreen
      // pulls eras from the site's content.ar_data via useActiveMonument
      // when monumentId is a real slug — the empty string is never read.
      glbUrl: '',
    });
  }, [navigation]);

  const handlePlaneAr = useCallback(() => {
    console.log('[DevLoadTestArModel] nav to PlaneArTest with', KHRONOS_DUCK_URL);
    navigation.navigate(ROUTES.MAIN.PLANE_AR_TEST, {
      glbUrl: KHRONOS_DUCK_URL,
      label: 'Duck',
    });
  }, [navigation]);

  if (!__DEV__) return null;

  return (
    <View className="mx-5 mt-4 gap-y-2">
      <Pressable
        onPress={handleLoadDuck}
        accessibilityRole="button"
        accessibilityLabel="DEV: Load Test AR Model"
        className="rounded-2xl border border-[rgba(232,160,32,0.45)] bg-[rgba(232,160,32,0.08)] px-4 py-3"
      >
        <Text className="text-accent-amber font-montserrat-bold text-[13px] tracking-[1.6px]">
          DEV: LOAD TEST AR MODEL
        </Text>
        <Text className="text-[rgba(255,255,255,0.55)] font-montserrat text-[11px] mt-1">
          Khronos Duck · placeholder · removed in production builds
        </Text>
      </Pressable>

      <Pressable
        onPress={handleKonarkShell}
        accessibilityRole="button"
        accessibilityLabel="DEV: Konark shell"
        className="rounded-2xl border border-[rgba(232,160,32,0.45)] bg-[rgba(232,160,32,0.08)] px-4 py-3"
      >
        <Text className="text-accent-amber font-montserrat-bold text-[13px] tracking-[1.6px]">
          DEV: KONARK SHELL (NO MODELS)
        </Text>
        <Text className="text-[rgba(255,255,255,0.55)] font-montserrat text-[11px] mt-1">
          Era shell preview · all stops show "coming soon"
        </Text>
      </Pressable>

      <Pressable
        onPress={handlePlaneAr}
        accessibilityRole="button"
        accessibilityLabel="DEV: Plane AR test"
        className="rounded-2xl border border-[rgba(232,160,32,0.45)] bg-[rgba(232,160,32,0.08)] px-4 py-3"
      >
        <Text className="text-accent-amber font-montserrat-bold text-[13px] tracking-[1.6px]">
          DEV: PLANE AR TEST (DUCK)
        </Text>
        <Text className="text-[rgba(255,255,255,0.55)] font-montserrat text-[11px] mt-1">
          Tap a real floor · ARCore plane detection · no Geospatial
        </Text>
      </Pressable>
    </View>
  );
};

export default DevLoadTestArModelButton;
