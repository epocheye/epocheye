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
  /**
   * The row's `object_media.disclosure`, drawn over the foot of the player.
   *
   * A GENERATED ASSET NEVER PLAYS WITHOUT ITS DISCLOSURE, and this is the place
   * that promise is hardest to slip: the strip that offered the poster can be
   * scrolled past, laid out compactly, or reused by a caller with less room,
   * but nothing plays without passing through here. `useSubjectMedia` already
   * refuses to return a generated row with an empty disclosure, so a caller
   * that forwards this field cannot draw a generated clip bare.
   *
   * Optional only because a non-generated clip legitimately has none.
   */
  disclosure?: string;
  onClose: () => void;
}

const FullscreenVideo: React.FC<Props> = ({
  uri,
  poster,
  disclosure,
  onClose,
}) => {
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

      {/* pointerEvents none so it never eats a tap meant for the transport
          controls sitting behind it. */}
      {disclosure ? (
        <SafeAreaView
          edges={['bottom']}
          style={styles.foot}
          pointerEvents="none">
          <Text style={styles.disclosure}>{disclosure}</Text>
        </SafeAreaView>
      ) : null}
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
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  disclosure: {
    color: 'rgba(245,240,232,0.82)',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 6,
  },
  failed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});

export default FullscreenVideo;
