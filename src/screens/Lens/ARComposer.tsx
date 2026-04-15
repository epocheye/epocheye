import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, ExternalLink, X } from 'lucide-react-native';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { FONTS } from '../../core/constants/theme';

type Props = MainScreenProps<'ARComposer'>;

// Today: thumbnail-first presentation with an "Open 3D model" handoff via
// Linking.openURL, which routes to Android's Scene Viewer or the system
// model-viewer on iOS. When @react-three/fiber + expo-gl are added to the
// bundle, replace the thumbnail View below with a GLView + GLTFLoader; the
// route, params, and quota flow stay identical.
const ARComposer: React.FC<Props> = ({ navigation, route }) => {
  const { monumentId, objectLabel, glbUrl, thumbnailUrl, cached, provider } =
    route.params;
  const insets = useSafeAreaInsets();

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
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>{objectLabel.toUpperCase()}</Text>
        <Pressable
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close 3D composer"
        >
          <X size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.previewWrap}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.preview}
            resizeMode="contain"
            accessibilityLabel={`${objectLabel} reconstruction preview`}
          />
        ) : (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#E8A020" />
            <Text style={styles.placeholderText}>3D model ready</Text>
          </View>
        )}

        <View style={styles.badges}>
          <View style={styles.badge}>
            <Box size={12} color="#E8A020" />
            <Text style={styles.badgeText}>
              {cached ? 'Cached' : 'Generated'} · {provider}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.monumentLine}>From {monumentId}</Text>
        <Pressable
          style={styles.ctaPrimary}
          onPress={openExternally}
          accessibilityRole="button"
        >
          <ExternalLink size={16} color="#0D0D0D" />
          <Text style={styles.ctaPrimaryText}>Open 3D model</Text>
        </Pressable>
        <Text style={styles.hint}>
          Opens in your device's AR / 3D viewer. Pinch to zoom, drag to rotate.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 13,
    letterSpacing: 2.5,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  previewWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  preview: { width: '100%', height: '80%' },
  placeholder: {
    alignItems: 'center',
    rowGap: 12,
  },
  placeholderText: {
    color: '#E8A020',
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  badges: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    columnGap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(232,160,32,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.35)',
  },
  badgeText: {
    color: '#E8A020',
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    rowGap: 10,
  },
  monumentLine: {
    color: '#8C93A0',
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#E8A020',
  },
  ctaPrimaryText: {
    color: '#0D0D0D',
    fontFamily: FONTS.bold,
    fontSize: 15,
  },
  hint: {
    color: '#8C93A0',
    fontFamily: FONTS.regular,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});

export default ARComposer;
