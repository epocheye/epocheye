/**
 * The brand mark that gets burned into a recorded clip.
 *
 * Because MediaProjection records the literal screen, this is not an overlay
 * applied afterwards — it is a real View that must be on screen for the whole
 * recording. Everything about it is therefore permanent in the user's video.
 *
 * THE CROP IS THE THING THAT WILL CATCH YOU OUT. Instagram centre-crops to 9:16,
 * removing (1 - a/0.5625)/2 of the height from each edge, where a = w/h:
 *
 *     1080x1920 (16:9)     0% cropped
 *     1080x2340 (19.5:9)   9.0% cropped top and bottom
 *     1080x2400 (20:9)    10.0% cropped top and bottom
 *
 * A lower third sitting on the safe-area inset is therefore cut off on every
 * modern phone. `bottomOffset` below solves for that and degrades to a normal
 * generous margin on a 16:9 screen.
 *
 * Fabric rules obeyed: no borderRadius + overflow:'hidden' anywhere (that combo
 * renders all children invisible on New Arch), and no Pressable fills.
 */
import React, {useMemo} from 'react';
import {StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

import {COLORS, FONTS} from '../../core/constants/theme';

interface Props {
  /** The site name, e.g. "Bangalore Fort". */
  title: string;
  /**
   * The era clause, e.g. "reconstructed 1791". Omitted entirely when unknown —
   * a placeholder year on a heritage claim is worse than no year.
   */
  era?: string;
  visible: boolean;
}

const RecordingWatermark: React.FC<Props> = ({title, era, visible}) => {
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const bottomOffset = useMemo(() => {
    const cropFrac = Math.max(0, (1 - width / height / (9 / 16)) / 2);
    return Math.max(insets.bottom + 16, height * (cropFrac + 0.03));
  }, [width, height, insets.bottom]);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[styles.root, {bottom: bottomOffset}]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.82)']}
        style={styles.scrim}
      />
      <View style={styles.rule} />
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {title.toUpperCase()}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {era ? `${era}  ·  ` : ''}
        <Text style={styles.wordmark}>EPOCHEYE</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 22,
    right: 22,
  },
  scrim: {
    position: 'absolute',
    left: -22,
    right: -22,
    bottom: -80,
    height: 190,
  },
  rule: {
    width: 44,
    height: 2,
    backgroundColor: COLORS.gold,
    marginBottom: 10,
  },
  title: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: 1.5,
  },
  meta: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 6,
  },
  wordmark: {
    color: COLORS.gold,
    fontFamily: FONTS.uiSemiBold,
    letterSpacing: 2.6,
  },
});

export default RecordingWatermark;
