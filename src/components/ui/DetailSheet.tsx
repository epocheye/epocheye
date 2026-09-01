/**
 * The one-tap sheet that holds everything a screen is not primarily about.
 *
 * WHY IT IS SHARED. Two screens now make the same move for the same reason.
 * The magic window put its legend, plan, credits and viewpoint rail behind a
 * tap so the reconstruction could be the product; the audio guide puts its stop
 * list, persona, speed and transcript behind a tap so the CURRENT STOP can be.
 * Both had grown into forms with the real thing behind them. One shell keeps
 * them behaving identically — same slide, same grabber, same close target —
 * rather than two sheets that drift.
 *
 * ALWAYS MOUNTED, NEVER UNMOUNTED. Both callers keep a single <AudioPlayer/>
 * inside the sheet, so the sheet is translated off-screen when closed rather
 * than removed. Unmounting would restart a 105 s clip every time the visitor
 * closed it. `pointerEvents="none"` is what stops the hidden sheet swallowing
 * taps meant for the screen behind it — without it the closed sheet is an
 * invisible wall across the bottom of the screen.
 *
 * NOTHING IS DELETED BY MOVING IT HERE. Removing the ability to reach the
 * evidence would be a worse product than a cluttered one: the legend is what
 * says which parts of a building are confirmed, the credits are a licence
 * obligation, and the transcript is the only path for a visitor who cannot
 * hear. They move behind a tap. They do not go away.
 */

import React, {useEffect} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {X} from 'lucide-react-native';

import {COLORS, FONTS, RADIUS, SPACING} from '../../core/constants/theme';

export interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  /** Spoken by a screen reader on the close control. */
  closeLabel?: string;
  children?: React.ReactNode;
}

const DetailSheet: React.FC<DetailSheetProps> = ({
  open,
  onClose,
  closeLabel = 'Close details',
  children,
}) => {
  // Driven off the window height rather than the sheet's own measured height,
  // because the sheet has to be off-screen on the FIRST frame - before any
  // layout pass has run - or it flashes across the screen on mount.
  const {height} = useWindowDimensions();
  const offset = useSharedValue(height);

  useEffect(() => {
    offset.value = withTiming(open ? 0 : height, {duration: 240});
  }, [open, height, offset]);

  const slide = useAnimatedStyle(() => ({
    transform: [{translateY: offset.value}],
  }));

  return (
    <Animated.View
      style={[styles.sheet, slide]}
      pointerEvents={open ? 'auto' : 'none'}>
      <View style={styles.grabRow}>
        <View style={styles.grabber} />
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}>
          <X size={18} color={COLORS.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: 'rgba(10,10,12,0.97)',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  grabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
  },
  closeButton: {
    position: 'absolute',
    right: SPACING.lg,
    top: SPACING.xs,
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  body: {padding: SPACING.lg, paddingBottom: SPACING.xl},
});

/**
 * The shared typography INSIDE a sheet, exported so both callers write the same
 * section rather than each inventing one. A sheet is a stack of titled blocks;
 * these are the four pieces every block is made of.
 */
export const SHEET = StyleSheet.create({
  block: {marginBottom: SPACING.lg},
  heading: {
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  meta: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  text: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 14,
    lineHeight: 21,
  },
});

export default DetailSheet;
