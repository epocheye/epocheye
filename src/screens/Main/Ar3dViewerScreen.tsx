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

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';

import GLBViewer from '../Lens/components/GLBViewer';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../core/constants/theme';
import type { MainStackParamList } from '../../core/types/navigation.types';

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {prettyLabel(objectLabel)}
          </Text>
          <Text style={styles.subtitle}>3D preview · drag to rotate · pinch to zoom</Text>
        </View>
        <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          AR not supported on this device — showing the 3D preview instead.
        </Text>
      </View>

      <View style={styles.viewerWrap}>
        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : (
          <GLBViewer
            url={glbUrl}
            autoRotate
            onError={(e) => setLoadError(e?.message || 'Failed to load 3D model')}
          />
        )}
      </View>

      {knowledgeText ? (
        <ScrollView style={styles.factsScroll} contentContainerStyle={styles.factsBody}>
          <Text style={styles.factsHeading}>About this</Text>
          <Text style={styles.factsBodyText}>{knowledgeText}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg ?? 20,
    paddingVertical: SPACING.md ?? 16,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 1,
  },
  title: {
    color: '#F5F0E8',
    fontFamily: FONTS.regular,
    fontSize: FONT_SIZES.title,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeText: {
    color: '#F5F0E8',
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  banner: {
    marginHorizontal: SPACING.lg ?? 20,
    marginTop: SPACING.md ?? 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(232,160,32,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.18)',
  },
  bannerText: {
    color: '#E8A020',
    fontFamily: FONTS.regular,
    fontSize: 12,
  },
  viewerWrap: {
    flex: 1,
    margin: SPACING.lg ?? 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  factsScroll: {
    maxHeight: 220,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  factsBody: {
    paddingHorizontal: SPACING.lg ?? 20,
    paddingVertical: SPACING.md ?? 16,
  },
  factsHeading: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FONTS.regular,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  factsBodyText: {
    color: '#F5F0E8',
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
});

export default Ar3dViewerScreen;
