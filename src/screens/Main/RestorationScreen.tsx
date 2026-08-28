/**
 * RestorationScreen — the frozen-frame reveal.
 *
 * Point at the wall, tap once, the frame freezes, and the room cross-dissolves
 * back to how it looked. Then a handle wipes between the two.
 *
 * This is NOT tracked AR. There is no ARCore, no anchoring, no plane finding —
 * a still photograph and an image, which is why it works on any device with a
 * camera. It is deliberately a separate screen from DetectArScreen, which
 * already interleaves production, __DEV__ and admin-harness paths across
 * ARCore, cloud anchor, geospatial, the dev picker and the 2D fallback.
 *
 * The caption is authored prose from the clip, never composed here. What the
 * reconstruction is evidenced by — and which part of it is inference — is the
 * product's whole position, so it travels with the image, including into the
 * saved file.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Share from 'react-native-share';
import { Minus, Plus, Share2, Sun, X, Zap, ZapOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../../core/constants/theme';
import type { MainScreenProps } from '../../core/types/navigation.types';
import { useSafeGoBack } from '../../shared/hooks/useSafeGoBack';
import { showToast } from '../../shared/ui/appAlert';
import { composeBeforeAfter } from '../../shared/services/restorationComposite';

type Props = MainScreenProps<'Restoration'>;

/** Cross-dissolve duration, per the brief. */
const DISSOLVE_MS = 2000;

/**
 * Number of steps across the device's exposure range. The range itself varies
 * wildly by device (some report ±2 EV, others ±12 compensation units), so the
 * control is expressed in steps and the EV value is derived, never hardcoded.
 */
const EXPOSURE_STEPS = 8;

type Phase = 'framing' | 'revealing' | 'wipe';

const RestorationScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const { imageUrl, caption, title, siteName } = route.params;
  const goBack = useSafeGoBack();
  const { width } = useWindowDimensions();

  const cameraRef = useRef<VisionCamera | null>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Prefer a format that can do HDR stills. On Android this is a vendor
  // extension that brackets a low- and a high-exposure frame, which is exactly
  // the right trade in a dim room: the shadows come up without the surviving
  // bright fragments blowing out. supportsPhotoHdr lives on the FORMAT, not the
  // device, so it can only be read after a format has been chosen.
  // Filter on HDR only. An earlier draft also asked for photoResolution 'max',
  // which is a trap here: the share composite allocates an offscreen Skia
  // surface at the captured photo's full dimensions, so a 100MP sensor would
  // turn a working export into an OOM. Resolution stays at the library default.
  const format = useCameraFormat(device, [{ photoHdr: true }]);
  const photoHdr = format?.supportsPhotoHdr ?? false;

  const [phase, setPhase] = useState<Phase>('framing');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Exposure bias in the device's own units. Starts NEUTRAL, deliberately:
  // stop 1 is on an open lawn and stop 3 is a windowless upper room, and nothing
  // available here can tell them apart — vision-camera exposes no ambient-light
  // reading, so any automatic "it's dark" bias would be a guess that blows out
  // the outdoor stops. The visitor can see the preview; they decide.
  const [exposure, setExposure] = useState(0);

  const minExposure = device?.minExposure ?? 0;
  const maxExposure = device?.maxExposure ?? 0;
  const canAdjustExposure = maxExposure > minExposure;
  const exposureStep = canAdjustExposure
    ? (maxExposure - minExposure) / EXPOSURE_STEPS
    : 0;

  const nudgeExposure = useCallback(
    (direction: 1 | -1) => {
      if (!canAdjustExposure) return;
      setExposure(prev =>
        Math.min(
          maxExposure,
          Math.max(minExposure, prev + direction * exposureStep),
        ),
      );
    },
    [canAdjustExposure, exposureStep, maxExposure, minExposure],
  );

  // The restored image fades in over the frozen photo; the same value later
  // drives nothing, since the wipe uses `splitX`. Kept separate so the dissolve
  // can finish before the handle appears.
  const restoredOpacity = useSharedValue(0);
  // Wipe position in px. Starts mid-frame so both states are visible the moment
  // the handle appears.
  const splitX = useSharedValue(width / 2);
  const dragStartX = useSharedValue(0);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // Fetch the restoration up front. Doing it here rather than at reveal time
  // means the dissolve never cross-fades into a half-decoded image.
  useEffect(() => {
    if (imageUrl) void Image.prefetch(imageUrl).catch(() => undefined);
  }, [imageUrl]);

  const handleCapture = useCallback(async () => {
    if (busy || phase !== 'framing') return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
      if (!photo?.path) {
        showToast(t('restoration.captureFailed'));
        return;
      }
      // vision-camera returns a bare filesystem path; <Image> needs a URI.
      setPhotoUri(
        photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`,
      );
      setTorch(false);
      setPhase('revealing');
      restoredOpacity.value = withTiming(1, { duration: DISSOLVE_MS });
      // Hand over to the wipe once the dissolve has actually finished, so the
      // handle never appears over a still-fading image.
      setTimeout(() => setPhase('wipe'), DISSOLVE_MS + 150);
    } catch {
      showToast(t('restoration.captureFailed'));
    } finally {
      setBusy(false);
    }
  }, [busy, phase, restoredOpacity, t]);

  const handleShare = useCallback(async () => {
    if (!photoUri || sharing) return;
    setSharing(true);
    try {
      const uri = await composeBeforeAfter({
        beforeUri: photoUri,
        afterUri: imageUrl,
        // Read the shared value on the JS thread at share time so the export
        // matches the handle exactly where the user left it.
        splitFraction: splitX.value / width,
        caption,
        // The MONUMENT, not the stop. Falling back to the stop title is better
        // than an unbranded export, but a share reading "The colour that is
        // gone" identifies nothing to whoever receives it.
        siteName: siteName ?? title,
      });
      // The composite stays in the app cache; the share sheet is the only way
      // it leaves. Nothing is written to the photo library, which is why this
      // needs no storage permission.
      await Share.open({
        url: uri,
        type: 'image/jpeg',
        failOnCancel: false,
      });
    } catch (err) {
      // Surface WHY. A silent failure is unactionable: composing and sharing
      // fail for completely different reasons.
      if (__DEV__) {
        console.warn('[restoration] share failed', err);
      }
      showToast(t('restoration.shareFailed'));
    } finally {
      setSharing(false);
    }
  }, [photoUri, imageUrl, caption, title, siteName, sharing, splitX, width, t]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragStartX.value = splitX.value;
    })
    .onUpdate(e => {
      const next = dragStartX.value + e.translationX;
      splitX.value = Math.max(0, Math.min(width, next));
    });

  const tapTrack = Gesture.Tap().onEnd(e => {
    splitX.value = Math.max(0, Math.min(width, e.x));
  });

  const wipeGesture = Gesture.Race(pan, tapTrack);

  // The restored layer is clipped to the RIGHT of the handle: photo on the
  // left (as it is now), restoration on the right (as it was).
  const restoredClipStyle = useAnimatedStyle(() => ({
    opacity: restoredOpacity.value,
    left: splitX.value,
    width: Math.max(0, width - splitX.value),
  }));
  const restoredInnerStyle = useAnimatedStyle(() => ({
    marginLeft: -splitX.value,
    width,
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: splitX.value - 1 }],
  }));

  /* ── Framing ───────────────────────────────────────────────────────────── */
  if (phase === 'framing') {
    if (!device) {
      return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>{t('restoration.noCamera')}</Text>
            <Pressable onPress={goBack} style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    if (!hasPermission) {
      return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>
              {t('restoration.permissionTitle')}
            </Text>
            <Text style={styles.emptyBody}>
              {t('restoration.permissionBody')}
            </Text>
            <Pressable
              onPress={() => void requestPermission()}
              style={styles.secondaryBtn}>
              <Text style={styles.secondaryText}>{t('common.enable')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.root}>
        <VisionCamera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive
          photo
          torch={torch ? 'on' : 'off'}
          // A dark interior is the expected case here, not an edge case — the
          // rooms worth restoring are the ones with no windows.
          lowLightBoost={device.supportsLowLightBoost}
          photoHdr={photoHdr}
          exposure={exposure}
        />
        <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
          {/* Grouped so the space-between overlay keeps treating the header and
              its torch notice as one top block. */}
          <View>
            <View style={styles.topRow}>
              <Pressable onPress={goBack} hitSlop={12} style={styles.iconBtn}>
                <X size={18} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.topTitle} numberOfLines={1}>
                {title || t('restoration.title')}
              </Text>
              <Pressable
                onPress={() => setTorch(v => !v)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('restoration.torch')}
                style={styles.iconBtn}>
                {torch ? (
                  <Zap size={18} color={COLORS.gold} />
                ) : (
                  <ZapOff size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>

            {/* The ASI lists torches among prohibited items at protected
                monuments (its "do not use flashlights" rule means handheld
                lamps, not camera flash). We cannot know which venue the visitor
                is standing in, and they can read the signage we cannot — so
                this informs rather than blocks. Shown only while the lamp is
                actually on, so it reads as a consequence of their action. */}
            {torch ? (
              <View style={styles.torchNotice}>
                <Text style={styles.torchNoticeText}>
                  {t('restoration.torchWarning')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.bottomBlock}>
            {canAdjustExposure ? (
              <View style={styles.exposureRow}>
                <Pressable
                  onPress={() => nudgeExposure(-1)}
                  disabled={exposure <= minExposure}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('restoration.exposureDown')}
                  style={[
                    styles.exposureBtn,
                    exposure <= minExposure && styles.exposureBtnOff,
                  ]}>
                  <Minus size={16} color="#FFFFFF" />
                </Pressable>
                <View style={styles.exposureLabel}>
                  <Sun size={14} color={COLORS.gold} />
                  <Text style={styles.exposureText}>
                    {exposure === 0
                      ? t('restoration.brightness')
                      : `${exposure > 0 ? '+' : ''}${exposure.toFixed(1)}`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => nudgeExposure(1)}
                  disabled={exposure >= maxExposure}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('restoration.exposureUp')}
                  style={[
                    styles.exposureBtn,
                    exposure >= maxExposure && styles.exposureBtnOff,
                  ]}>
                  <Plus size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}
            {/* A raised exposure buys light by holding the shutter open longer,
                so camera shake is the thing that ruins the frame, not darkness. */}
            <Text style={styles.hint}>
              {exposure > 0
                ? t('restoration.holdStill')
                : t('restoration.frameHint')}
            </Text>
            <Pressable
              onPress={() => void handleCapture()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('restoration.capture')}
              style={[styles.shutter, busy && styles.shutterBusy]}>
              {busy ? <ActivityIndicator color="#0A0A0A" /> : null}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ── Reveal + wipe ─────────────────────────────────────────────────────── */
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.topRow}>
          <Pressable onPress={goBack} hitSlop={12} style={styles.iconBtn}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {title || t('restoration.title')}
          </Text>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>

      <GestureDetector gesture={wipeGesture}>
        <View style={[styles.stage, { width, height: width * (4 / 3) }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.layer} />
          ) : null}

          {/* Restored layer, clipped to the right of the handle. The inner
              image is shifted back by the same amount so it stays registered
              with the photo underneath rather than sliding as the wipe moves. */}
          <Animated.View style={[styles.clip, restoredClipStyle]}>
            <Animated.Image
              source={{ uri: imageUrl }}
              style={[styles.layer, restoredInnerStyle]}
              resizeMode="cover"
            />
          </Animated.View>

          {phase === 'wipe' && (
            <Animated.View style={[styles.handle, handleStyle]}>
              <View style={styles.handleKnob} />
            </Animated.View>
          )}
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}

        {phase === 'wipe' && (
          <Pressable
            onPress={() => void handleShare()}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityLabel={t('restoration.share')}
            style={[styles.saveBtn, sharing && styles.saveBtnBusy]}>
            {sharing ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <Share2 size={16} color="#0A0A0A" />
                <Text style={styles.saveText}>{t('restoration.share')}</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  topTitle: {
    flex: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.body,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  torchNotice: {
    marginHorizontal: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.gold,
  },
  torchNoticeText: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: '#F4EFE7',
    lineHeight: 17,
  },
  bottomBlock: { alignItems: 'center', paddingBottom: SPACING.xxl, gap: SPACING.lg },
  exposureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  exposureBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  exposureBtnOff: { opacity: 0.35 },
  exposureLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minWidth: 74,
    justifyContent: 'center',
  },
  exposureText: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    color: '#FFFFFF',
  },
  hint: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.small,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.gold,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBusy: { opacity: 0.7 },
  stage: { backgroundColor: '#000000', overflow: 'hidden' },
  layer: { ...StyleSheet.absoluteFillObject },
  clip: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleKnob: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  footer: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, gap: SPACING.lg },
  caption: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.caption,
    lineHeight: FONT_SIZES.caption * 1.5,
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.gold,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: '#0A0A0A',
  },
  emptyTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.subtitle,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FONTS.sans,
    fontSize: FONT_SIZES.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  secondaryBtn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.amberSubtle,
  },
  secondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: FONT_SIZES.small,
    color: COLORS.textPrimary,
  },
});

export default RestorationScreen;
