/**
 * FullscreenVideo — the tap-to-enlarge player for a video card. A world-anchored
 * card plays its clip small and silent in the palace; tapping it opens the same
 * clip here, full screen, with the platform's own transport controls.
 *
 * An absolute-fill overlay rather than a React Native <Modal>: the journey is
 * itself a fullScreenModal, and a nested <Modal> on Android/Fabric is a known
 * source of paint glitches (see ARSafetyNotice). The host screen closes it on
 * hardware back through its back intercept.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Video from 'react-native-video';
import { X } from 'lucide-react-native';

import { JOURNEY_TEXT, journeyStyles } from './JourneyUi';

interface Props {
  uri: string;
  poster?: string;
  onClose: () => void;
}

const FullscreenVideo: React.FC<Props> = ({ uri, poster, onClose }) => {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.root}>
      {failed ? (
        <View style={styles.failed}>
          <Text style={journeyStyles.body}>{t('journey.explore.videoError')}</Text>
        </View>
      ) : (
        <Video
          source={{ uri }}
          poster={poster ? { source: { uri: poster }, resizeMode: 'contain' } : undefined}
          controls
          resizeMode="contain"
          ignoreSilentSwitch="ignore"
          onError={e => {
            if (__DEV__) console.warn('[journey] card video failed', e);
            setFailed(true);
          }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('journey.explore.closeVideo')}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <X size={20} color={JOURNEY_TEXT} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 40,
    elevation: 40,
  },
  top: { position: 'absolute', top: 0, right: 0, padding: 12 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.6)',
  },
  pressed: { opacity: 0.85 },
  failed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});

export default FullscreenVideo;
