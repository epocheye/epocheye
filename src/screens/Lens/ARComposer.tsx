import React, { Component, Suspense, lazy, useCallback, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlert as Alert } from '../../shared/ui/appAlert';
import { Box, ExternalLink, X } from 'lucide-react-native';
import type { MainScreenProps } from '../../core/types/navigation.types';

// Lazy-loaded so @react-three/fiber + expo-gl are NOT evaluated at app startup.
// r3f v8 is incompatible with React 19 and throws at module-evaluation time,
// crashing the entire JS bundle before AppRegistry runs if imported eagerly.
const GLBViewer = lazy(() => import('./components/GLBViewer'));

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

type Props = MainScreenProps<'ARComposer'>;

// Inline 3D rendering via @react-three/fiber + expo-gl with a Scene Viewer
// intent fallback. If the in-bundle GL viewer fails to initialize (e.g. bare
// RN rebuild pending), the Open 3D model CTA still hands the user off to the
// system AR viewer so the experience degrades gracefully.
const ARComposer: React.FC<Props> = ({ navigation, route }) => {
  const {
    monumentId,
    objectLabel,
    glbUrl,
    thumbnailUrl,
    cached,
    provider,
    quality = 'none',
    scanCount = 0,
    isTestMode = false,
    testObjectDescription,
  } = route.params;
  const insets = useSafeAreaInsets();
  const [inlineViewerFailed, setInlineViewerFailed] = useState(false);

  const openExternally = useCallback(() => {
    const intentUrl = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrl)}&mode=ar_preferred#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`;
    Linking.canOpenURL(intentUrl)
      .then(canOpen => (canOpen ? Linking.openURL(intentUrl) : Linking.openURL(glbUrl)))
      .catch(() => {
        Alert.alert(
          'Could not open 3D model',
          'Please install Google Scene Viewer from the Play Store, or try again later.',
        );
      });
  }, [glbUrl]);

  return (
    <View className="flex-1 bg-surface-1">
      <View
        className="px-4 pb-3 flex-row items-center justify-between"
        style={{paddingTop: insets.top + 10}}
      >
        <Text className="text-parchment font-ui-semibold text-[13px] tracking-[2.5px]">
          {objectLabel.toUpperCase()}
        </Text>
        <Pressable
          className="w-[34px] h-[34px] rounded-full items-center justify-center bg-[rgba(255,255,255,0.08)]"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close 3D composer"
        >
          <X size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {inlineViewerFailed ? (
          thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              className="w-full h-[80%]"
              resizeMode="contain"
              accessibilityLabel={`${objectLabel} reconstruction preview`}
            />
          ) : (
            <View className="items-center gap-y-3">
              <Text className="text-accent-amber font-ui-semibold text-[14px]">
                3D model ready
              </Text>
            </View>
          )
        ) : (
          <GLBErrorBoundary onError={() => setInlineViewerFailed(true)}>
            <Suspense fallback={null}>
              <GLBViewer
                url={glbUrl}
                autoRotate
                onError={() => setInlineViewerFailed(true)}
              />
            </Suspense>
          </GLBErrorBoundary>
        )}

        <View className="absolute top-5 self-center flex-row gap-x-2">
          <View className="flex-row items-center gap-x-[6px] px-[10px] py-1 bg-[rgba(203,168,98,0.14)] rounded-full border border-[rgba(203,168,98,0.35)]">
            <Box size={12} color="#CBA862" />
            <Text className="text-accent-amber font-ui-semibold text-[11px]">
              {cached ? 'Cached' : 'Generated'} · {provider}
            </Text>
          </View>
          {quality === 'multi_view' && (
            <View className="flex-row items-center gap-x-[6px] px-[10px] py-1 bg-[rgba(76,175,80,0.14)] rounded-full border border-[rgba(76,175,80,0.35)]">
              <Text className="text-[#4CAF50] font-ui-semibold text-[11px]">
                Community 3D
              </Text>
            </View>
          )}
          {quality === 'single_view' && (
            <View className="flex-row items-center gap-x-[6px] px-[10px] py-1 bg-[rgba(203,168,98,0.14)] rounded-full border border-[rgba(203,168,98,0.35)]">
              <Text className="text-accent-amber font-ui-semibold text-[11px]">Basic 3D</Text>
            </View>
          )}
          {scanCount > 0 && (
            <View className="flex-row items-center gap-x-[6px] px-[10px] py-1 bg-[rgba(203,168,98,0.14)] rounded-full border border-[rgba(203,168,98,0.35)]">
              <Text className="text-accent-amber font-ui-semibold text-[11px]">
                {scanCount} {scanCount === 1 ? 'scan' : 'scans'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View
        className="px-6 pt-4 border-t border-[rgba(255,255,255,0.06)] items-center gap-y-[10px]"
        style={{paddingBottom: insets.bottom + 16}}
      >
        {isTestMode ? (
          <>
            <Text className="text-parchment font-ui-semibold text-[18px]">{monumentId}</Text>
            {testObjectDescription ? (
              <Text className="text-[#B8AF9E] font-ui text-[13px] text-center px-2">
                {testObjectDescription}
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="text-grey-muted font-ui-medium text-[12px]">
            From {monumentId}
          </Text>
        )}
        <Pressable
          className="flex-row items-center gap-x-2 px-[22px] py-[13px] rounded-xl bg-accent-amber"
          onPress={openExternally}
          accessibilityRole="button"
        >
          <ExternalLink size={16} color="#0D0D0D" />
          <Text className="text-[#0D0D0D] font-ui-semibold text-[15px]">Open 3D model</Text>
        </Pressable>
        <Text className="text-grey-muted font-ui text-[11px] text-center px-3">
          Opens in your device's AR / 3D viewer. Pinch to zoom, drag to rotate.
        </Text>
      </View>
    </View>
  );
};

export default ARComposer;
