/**
 * Ar3dViewerScreen — non-AR fallback for phones without ARCore Geospatial.
 *
 * Renders the matched asset in a Three.js orbit/zoom viewer (no world-lock,
 * no camera feed) and shows the knowledge-text card below. The "AR not
 * supported" banner explains why the user isn't getting the full AR view.
 *
 * Mobile branches into this screen when:
 *   - useArcoreAvailability().available === false
 *   - OR the recognise response includes place_strategy='viewer_only'
 *
 * The actual GLB rendering reuses the existing GLBViewer component which
 * is already wired to @react-three/fiber/native + expo-gl. We just compose
 * it with the screen chrome / knowledge text / dismiss button.
 */

import React, { Component, Suspense, lazy, useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';

import type { MainStackParamList } from '../../core/types/navigation.types';

// Lazy-loaded so @react-three/fiber + expo-gl are NOT evaluated at app startup.
// r3f v8 is incompatible with React 19 and throws at module-evaluation time,
// crashing the entire JS bundle before AppRegistry runs if imported eagerly.
const GLBViewer = lazy(() => import('../Lens/components/GLBViewer'));

interface GLBErrorBoundaryProps {
  onError: () => void;
  children: React.ReactNode;
}
interface GLBErrorBoundaryState { crashed: boolean }

class GLBErrorBoundary extends Component<GLBErrorBoundaryProps, GLBErrorBoundaryState> {
  state: GLBErrorBoundaryState = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

type RouteProp = {
  key: string;
  name: 'Ar3dViewer';
  params: MainStackParamList['Ar3dViewer'];
};

const Ar3dViewerScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute() as unknown as RouteProp;
  const { objectLabel, glbUrl, knowledgeText } = route.params;

  const [loadError, setLoadError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView className="flex-1 bg-surface-1" edges={['top', 'bottom']}>
      <View className="flex-row items-center px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <View className="flex-1">
          <Text className="text-parchment font-montserrat text-[18px]" numberOfLines={1}>
            {prettyLabel(objectLabel)}
          </Text>
          <Text className="text-[rgba(255,255,255,0.5)] font-montserrat text-[12px] mt-0.5">
            3D preview · drag to rotate · pinch to zoom
          </Text>
        </View>
        <Pressable
          onPress={handleClose}
          hitSlop={8}
          className="px-3 py-[6px] rounded-[8px] bg-[rgba(255,255,255,0.06)]"
        >
          <Text className="text-parchment font-montserrat-medium text-[12px]">Done</Text>
        </Pressable>
      </View>

      <View className="mx-5 mt-3 px-3 py-2 bg-[rgba(232,160,32,0.08)] rounded-[8px] border border-[rgba(232,160,32,0.18)]">
        <Text className="text-accent-amber font-montserrat text-[12px]">
          AR not supported on this device — showing the 3D preview instead.
        </Text>
      </View>

      <View className="flex-1 m-5 rounded-2xl overflow-hidden bg-[rgba(255,255,255,0.02)]">
        {loadError ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-[rgba(255,255,255,0.6)] font-montserrat text-[14px] text-center px-10">
              {loadError}
            </Text>
          </View>
        ) : (
          <GLBErrorBoundary onError={() => setLoadError('3D preview unavailable on this device.')}>
            <Suspense fallback={<View className="flex-1" />}>
              <GLBViewer
                url={glbUrl}
                autoRotate
                onError={(e) => setLoadError(e?.message || 'Failed to load 3D model')}
              />
            </Suspense>
          </GLBErrorBoundary>
        )}
      </View>

      {knowledgeText ? (
        <ScrollView
          className="max-h-[220px] border-t border-[rgba(255,255,255,0.06)]"
          contentContainerStyle={{paddingHorizontal: 20, paddingVertical: 16}}
        >
          <Text className="text-[rgba(255,255,255,0.5)] font-montserrat text-[11px] tracking-[1.6px] uppercase mb-2">
            About this
          </Text>
          <Text className="text-parchment font-montserrat text-[14px] leading-[22px]">
            {knowledgeText}
          </Text>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

function prettyLabel(label: string): string {
  return label
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export default Ar3dViewerScreen;
