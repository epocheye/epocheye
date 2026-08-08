/**
 * Shown once a clip has been recorded and saved.
 *
 * Sharing goes through the native chooser rather than RN's built-in
 * `Share.share()`, which on Android can only send text — its `url` field is
 * iOS-only, so it cannot attach the video at all. The chooser carries the file
 * as a content:// uri, which is what puts Instagram, WhatsApp and the rest in
 * the list.
 */
import React, {useCallback, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';

import {COLORS, FONTS} from '../../core/constants/theme';
import {shareClip, type ClipResult} from '../../native/ScreenRecorder';

interface Props {
  clip: ClipResult;
  siteName: string;
  onClose: () => void;
}

/** Maps a degraded outcome to the i18n key that explains it. */
function caveatKey(clip: ClipResult): string | null {
  switch (clip.degraded) {
    case 'save_failed':
      return 'clip.saveFailed';
    case 'projection_revoked':
      return 'clip.endedEarly';
    case 'disk_full':
      return 'clip.diskFull';
    case 'interrupted_rotation':
      return 'clip.rotated';
    default:
      return clip.hasAudio ? null : 'clip.noSound';
  }
}

const ClipReadySheet: React.FC<Props> = ({clip, siteName, onClose}) => {
  const {t} = useTranslation();
  const [busy, setBusy] = useState(false);
  const seconds = Math.max(1, Math.round(clip.durationMs / 1000));
  const caveat = caveatKey(clip);

  const onShare = useCallback(async () => {
    setBusy(true);
    try {
      await shareClip({
        uri: clip.galleryUri ?? clip.uri,
        text: siteName ? `${siteName} · Epocheye` : 'Epocheye',
      });
    } catch {
      // The chooser refusing is not worth an error screen — the clip is saved
      // and the user can share it from their gallery.
    } finally {
      setBusy(false);
    }
  }, [clip, siteName]);

  return (
    <Pressable style={styles.scrim} onPress={onClose}>
      <Animated.View entering={FadeInUp.duration(220)} style={styles.sheet}>
        <Text style={styles.title}>{t('clip.saved')}</Text>
        <Text style={styles.meta}>
          {t('clip.meta', {seconds, width: clip.width, height: clip.height})}
          {clip.galleryUri ? ` · ${t('clip.inGallery')}` : ''}
        </Text>
        {caveat ? <Text style={styles.caveat}>{t(caveat)}</Text> : null}

        <Pressable
          onPress={() => {
            void onShare();
          }}
          disabled={busy}
          accessibilityRole="button"
          style={({pressed}) => [styles.btnHit, pressed && {opacity: 0.85}]}>
          <View style={styles.btnFill}>
            <Text style={styles.btnText}>
              {busy ? t('clip.opening') : t('clip.share')}
            </Text>
          </View>
        </Pressable>

        <Pressable onPress={onClose} hitSlop={12} style={styles.doneHit}>
          <Text style={styles.doneText}>{t('clip.done')}</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: 'rgba(10,10,10,0.97)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 30,
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
  },
  title: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.display,
    fontSize: 22,
  },
  meta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginTop: 6,
  },
  caveat: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginTop: 10,
  },
  btnHit: {marginTop: 20, borderRadius: 14},
  btnFill: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
  },
  btnText: {
    color: '#0A0A0A',
    fontFamily: FONTS.uiSemiBold,
    fontSize: 15,
  },
  doneHit: {alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16},
  doneText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 13,
  },
});

export default ClipReadySheet;
