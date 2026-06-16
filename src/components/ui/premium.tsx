/**
 * Premium UI primitives mirroring the Efecto design blocks, so screen rebuilds
 * stay concise and identical to the mockups. All token-driven (semantic
 * NativeWind classes + FONTS). Gradients use react-native-linear-gradient since
 * Tailwind `bg-gradient-to-*` is a no-op in React Native.
 */
import React from 'react';
import {StyleSheet, Text, View, type ViewProps, type ViewStyle} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {FONTS} from '../../core/constants/theme';

/** Dark glass card: solid elevated surface + hairline border + 28px radius. */
export const GlassCard: React.FC<ViewProps & {className?: string}> = ({
  className,
  style,
  children,
  ...rest
}) => (
  <View
    className={`rounded-[28px] border border-white/10 bg-card ${className ?? ''}`}
    style={style}
    {...rest}>
    {children}
  </View>
);

/** Frosted pill / chip used over images and as tags. */
export const Pill: React.FC<{className?: string; children: React.ReactNode}> = ({
  className,
  children,
}) => (
  <View
    className={`flex-row items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 ${
      className ?? ''
    }`}>
    {children}
  </View>
);

/** Stacked stat: Fraunces numeral over a wide-tracked micro label. */
export const StatCell: React.FC<{
  value: React.ReactNode;
  label: string;
  accent?: boolean;
}> = ({value, label, accent}) => (
  <View className="items-center">
    <Text
      style={{fontFamily: FONTS.display}}
      className={`text-2xl leading-none ${accent ? 'text-primary' : 'text-foreground'}`}>
      {value}
    </Text>
    <Text
      style={{fontFamily: FONTS.uiMedium}}
      className="mt-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
      {label}
    </Text>
  </View>
);

/** Section header: serif title + optional gold action link. */
export const SectionHeader: React.FC<{
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}> = ({title, action, onAction, className}) => (
  <View className={`flex-row items-baseline justify-between ${className ?? ''}`}>
    <Text style={{fontFamily: FONTS.display}} className="text-2xl text-foreground tracking-tight">
      {title}
    </Text>
    {action ? (
      <Text
        onPress={onAction}
        style={{fontFamily: FONTS.uiMedium}}
        className="text-[11px] tracking-[0.12em] text-primary uppercase">
        {action}
      </Text>
    ) : null}
  </View>
);

/** Soft ambient gold glow behind a screen header (top-anchored, absolute). */
export const AmbientGlow: React.FC<{height?: number}> = ({height = 320}) => (
  <LinearGradient
    colors={['rgba(203,168,98,0.16)', 'rgba(203,168,98,0.04)', 'rgba(10,10,12,0)']}
    locations={[0, 0.5, 1]}
    style={[styles.glow, {height}]}
    pointerEvents="none"
  />
);

/** Gradient scrim over hero/featured images for legible overlay text. */
export const ImageScrim: React.FC<{
  colors?: string[];
  locations?: number[];
  style?: ViewStyle;
}> = ({
  colors = ['transparent', 'rgba(10,10,12,0.2)', 'rgba(10,10,12,0.96)'],
  locations = [0, 0.45, 1],
  style,
}) => (
  <LinearGradient
    colors={colors}
    locations={locations}
    style={[StyleSheet.absoluteFill, style]}
    pointerEvents="none"
  />
);

const styles = StyleSheet.create({
  glow: {position: 'absolute', top: 0, left: 0, right: 0},
});
