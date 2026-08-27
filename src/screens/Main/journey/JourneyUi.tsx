/**
 * Shared chrome for the journey steps: the top bar (close / back / step label),
 * the two button styles, a quiet status pill for use over the camera feed, and
 * the text styles every step composes.
 *
 * StyleSheet + theme tokens rather than NativeWind classes because most of this
 * sits over a live ARCore feed, where absolute layout and solid backings for
 * legibility matter more than utility classes. Calm copy, gold accents, no
 * spinners — progress is always words.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { COLORS, FONTS } from '../../../core/constants/theme';
import { PermissionService } from '../../../shared/services/permission.service';
import { JOURNEY_STEPS, JOURNEY_STEP_COUNT } from '../../../stores/journeyStore';

export const JOURNEY_INK = '#0A0A0C';
export const JOURNEY_GOLD = COLORS.gold;
export const JOURNEY_TEXT = COLORS.textPrimary;
export const JOURNEY_TEXT_MUTED = COLORS.textSecondary;
/** Solid-enough backing for text over a bright daylight camera feed. */
export const JOURNEY_SCRIM = 'rgba(10,10,12,0.72)';

interface TopBarProps {
  stepIndex: number;
  /** Leave the journey (progress is saved). */
  onClose: () => void;
  /** Go to the previous step. Omit on the first step. */
  onBack?: () => void;
}

/**
 * Close on the left, "Step n of 4 · title" in the middle, and one dot per step
 * underneath. `pointerEvents="box-none"` so the AR feed behind it still takes
 * taps everywhere the bar has no control.
 */
export const JourneyTopBar: React.FC<TopBarProps> = ({ stepIndex, onClose, onBack }) => {
  const { t } = useTranslation();
  const stepId = JOURNEY_STEPS[stepIndex] ?? JOURNEY_STEPS[0];
  return (
    <SafeAreaView edges={['top']} style={styles.topSafe} pointerEvents="box-none">
      <View style={styles.topRow} pointerEvents="box-none">
        <Pressable
          onPress={onBack ?? onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={onBack ? t('common.back') : t('common.close')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          {onBack ? (
            <ChevronLeft size={20} color={JOURNEY_TEXT} />
          ) : (
            <X size={18} color={JOURNEY_TEXT} />
          )}
        </Pressable>

        <View style={styles.stepBlock} pointerEvents="none">
          <Text style={styles.stepLabel} numberOfLines={1}>
            {t('journey.stepOf', { n: stepIndex + 1, total: JOURNEY_STEP_COUNT })}
            {' · '}
            {t(`journey.steps.${stepId}`)}
          </Text>
          <View style={styles.dots}>
            {JOURNEY_STEPS.map((id, i) => (
              <View
                key={id}
                style={[
                  styles.dot,
                  i < stepIndex && styles.dotDone,
                  i === stepIndex && styles.dotCurrent,
                ]}
              />
            ))}
          </View>
        </View>

        {/* When a back control is showing, close still needs a home. */}
        {onBack ? (
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <X size={18} color={JOURNEY_TEXT} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>
    </SafeAreaView>
  );
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single main action on a step: gold pill, ink label (SiteDetail's CTA).
 *
 * THE FILL LIVES ON AN INNER VIEW, NOT ON THE PRESSABLE. It was reported from the field
 * as "there is no button, only a line" — the tap worked and advanced the step, so the
 * Pressable was present, correctly sized and hit-testing, but its gold background never
 * painted. All that showed was the footer's own 1px `borderTopColor` hairline.
 *
 * What that rules out matters as much as what it suggests: the surrounding panel
 * (`journeyStyles.panel`) carries `borderRadius: 18` with a background AND a border and
 * paints perfectly in the same screenshot, so plain `borderRadius` under Fabric is not
 * the problem. The difference here was that the visual sat on a `Pressable` with a
 * FUNCTION style (`style={({pressed}) => [...]}`) rather than a `View` with an object
 * style.
 *
 * Rather than depend on that resolving correctly, the Pressable is now a transparent hit
 * target and a plain `View` draws the pill. A plain View with an object style is the most
 * boringly reliable thing in React Native, and the press feedback moves to that View's
 * own style — so the visual no longer depends on the function-style path at all.
 */
export const PrimaryButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  icon,
  disabled,
  style,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    style={style}>
    {({ pressed }) => (
      <View
        style={[
          styles.primary,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}>
        {icon}
        <Text style={styles.primaryLabel}>{label}</Text>
      </View>
    )}
  </Pressable>
);

/**
 * The quieter alternative beside a primary: outlined gold, gold label.
 *
 * Same structure as PrimaryButton, and for the same reason — its gold BORDER was missing
 * in the same screenshot while its gold label rendered. See PrimaryButton above.
 */
export const GhostButton: React.FC<ButtonProps> = ({
  label,
  onPress,
  icon,
  disabled,
  style,
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    style={style}>
    {({ pressed }) => (
      <View
        style={[
          styles.ghost,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}>
        {icon}
        <Text style={styles.ghostLabel}>{label}</Text>
      </View>
    )}
  </Pressable>
);

interface StatusPillProps {
  text: string;
  /** Vertical position as a fraction of the screen; default sits above the controls. */
  style?: StyleProp<ViewStyle>;
}

/** One calm line over the camera feed, with a solid backing so daylight can't wash it out. */
export const StatusPill: React.FC<StatusPillProps> = ({ text, style }) => (
  <View style={[styles.statusWrap, style]} pointerEvents="none">
    <Text style={styles.statusText}>{text}</Text>
  </View>
);

interface CameraGateProps {
  /** Ask for the camera again. */
  onAllow: () => void;
  /** Carry on without the AR part of this step. */
  onSkip: () => void;
  skipLabel: string;
}

/**
 * Shown on an AR-capable phone when the camera was declined. The step can still
 * be skipped — the journey never dead-ends on a permission.
 */
export const CameraGate: React.FC<CameraGateProps> = ({ onAllow, onSkip, skipLabel }) => {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={journeyStyles.root} edges={['top', 'bottom']}>
      <View style={styles.gate}>
        <Camera size={40} color={JOURNEY_GOLD} />
        <Text style={[journeyStyles.title, styles.gateText]}>{t('lens.cameraTitle')}</Text>
        <Text style={[journeyStyles.body, styles.gateText]}>{t('lens.cameraBody')}</Text>
        <View style={journeyStyles.buttonRow}>
          <PrimaryButton label={t('lens.allowCamera')} onPress={onAllow} />
          <GhostButton
            label={t('lens.openSettings')}
            onPress={() => void PermissionService.openAppSettings()}
          />
          <GhostButton label={skipLabel} onPress={onSkip} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export const journeyStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JOURNEY_INK },
  /** Bottom panel over an AR feed — where a step's copy and buttons live. */
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: JOURNEY_SCRIM,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  /** Body for the non-AR steps; top padding clears the absolute JourneyTopBar. */
  page: { flex: 1, paddingHorizontal: 24, paddingTop: 76 },
  pageContent: { paddingBottom: 32, gap: 14 },
  eyebrow: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: JOURNEY_GOLD,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 26,
    lineHeight: 32,
    color: JOURNEY_TEXT,
  },
  body: {
    fontFamily: FONTS.ui,
    fontSize: 15,
    lineHeight: 22,
    color: JOURNEY_TEXT_MUTED,
  },
  bodyStrong: {
    fontFamily: FONTS.uiMedium,
    fontSize: 15,
    lineHeight: 22,
    color: JOURNEY_TEXT,
  },
  caption: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textTertiary,
  },
  /** Space below the top bar when a page starts with text rather than a feed. */
  afterTopBar: { height: 8 },
  buttonRow: { gap: 10, marginTop: 6 },
  /** Full-bleed tap target under every control (rendered first so buttons win). */
  tapLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /** Audio-only <Video>: zero-size and never seen. */
  hiddenAudio: { width: 0, height: 0, opacity: 0 },
});

const styles = StyleSheet.create({
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, elevation: 20 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.55)',
  },
  stepBlock: { flex: 1, alignItems: 'center', gap: 6 },
  stepLabel: {
    fontFamily: FONTS.uiSemiBold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: JOURNEY_TEXT,
    backgroundColor: 'rgba(10,10,12,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(244,239,231,0.30)',
  },
  dotDone: { backgroundColor: COLORS.goldDeep },
  dotCurrent: { backgroundColor: JOURNEY_GOLD, width: 18 },
  primary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: JOURNEY_GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  primaryLabel: { fontFamily: FONTS.display, fontSize: 20, color: JOURNEY_INK },
  ghost: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: JOURNEY_GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  ghostLabel: { fontFamily: FONTS.display, fontSize: 18, color: JOURNEY_GOLD },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  gateText: { textAlign: 'center' },
  statusWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '40%',
    alignItems: 'center',
  },
  statusText: {
    fontFamily: FONTS.uiMedium,
    fontSize: 16,
    lineHeight: 22,
    color: JOURNEY_TEXT,
    textAlign: 'center',
    backgroundColor: JOURNEY_SCRIM,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
