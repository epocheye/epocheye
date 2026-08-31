/**
 * Where am I standing, and which way am I facing.
 *
 * The palace is symmetrical and repetitive — five identical bays of colonnade,
 * pillars on a regular grid — so from inside it, one stop looks much like
 * another and the visitor has nothing to orient by. The viewpoint rail names
 * the stops but only while you are reading it, and the caption scrolls away.
 *
 * This draws the footprint once, marks the position with a dot and the facing
 * with a wedge, and keeps the stop name permanently on screen.
 *
 * THE PLAN IS NOT DRAWN BY HAND. Every coordinate comes from `PALACE_PLAN`,
 * which `emit_palace_ts.py` writes out of the build — the same numbers the
 * geometry itself was generated from. A change to `grid.bay_spacing_m` moves the
 * building and this drawing together, so the plan can never quietly disagree
 * with the model the visitor is standing in.
 *
 * The facing wedge is driven by the native `onHeading` event, which is derived
 * from the SAME forward vector that aims the camera — so the wedge cannot
 * disagree with the view either.
 */

import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import Svg, {Circle, G, Line, Path, Rect} from 'react-native-svg';

import {PALACE_PLAN} from './palace';
import {COLORS, FONTS, RADIUS, SPACING} from '../../core/constants/theme';

/** Drawn size of the collapsed plan, in points. */
const W = 116;
const H = 92;
const PAD = 7;

export interface PalacePlanIndicatorProps {
  /** Camera position in the building frame: [x, y, z] metres. */
  position: readonly [number, number, number] | number[];
  /** Compass heading of the view, degrees, 0 = +Y. Null before the first fix. */
  headingDeg: number | null;
  /** The stop's name, shown beneath the plan. */
  title: string;
  expanded: boolean;
  onToggle: () => void;
}

const PalacePlanIndicator: React.FC<PalacePlanIndicatorProps> = ({
  position,
  headingDeg,
  title,
  expanded,
  onToggle,
}) => {
  const p = PALACE_PLAN;
  const scale = expanded ? 2.1 : 1;
  const w = W * scale;
  const h = H * scale;

  /**
   * Building metres → SVG points.
   *
   * +X runs along the facade and +Y into the building, so the plan is drawn
   * with X across and Y DOWN the screen: the visitor arrives at the principal
   * facade (y = 0), which puts the front of the building at the top of the plan
   * — the way you would hold a paper plan walking in.
   */
  const t = useMemo(() => {
    const spanX = p.x_max - p.x_min;
    const spanY = p.y_max - p.y_min;
    const k = Math.min((w - 2 * PAD) / spanX, (h - 2 * PAD) / spanY);
    const ox = (w - spanX * k) / 2;
    const oy = (h - spanY * k) / 2;
    return {
      k,
      X: (mx: number) => ox + (mx - p.x_min) * k,
      Y: (my: number) => oy + (my - p.y_min) * k,
    };
  }, [p, w, h]);

  const px = t.X(position[0]);
  const py = t.Y(position[1]);

  // Heading 0 = +Y = down the screen, and it grows clockwise toward +X, which
  // is right. So screen angle = heading measured from "down".
  const wedge = useMemo(() => {
    if (headingDeg == null) return null;
    const r = 15 * scale;
    const half = 26;
    const a0 = ((headingDeg - half) * Math.PI) / 180;
    const a1 = ((headingDeg + half) * Math.PI) / 180;
    const pt = (a: number) => `${px + r * Math.sin(a)},${py + r * Math.cos(a)}`;
    return `M ${px},${py} L ${pt(a0)} A ${r},${r} 0 0 1 ${pt(a1)} Z`;
  }, [headingDeg, px, py, scale]);

  return (
    <Pressable
      onPress={onToggle}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={`You are at ${title}. Tap for a larger plan.`}>
      <Svg width={w} height={h}>
        {/* the whole footprint */}
        <Rect
          x={t.X(p.x_min)}
          y={t.Y(p.y_min)}
          width={(p.x_max - p.x_min) * t.k}
          height={(p.y_max - p.y_min) * t.k}
          fill="rgba(255,255,255,0.05)"
          stroke={COLORS.textMuted}
          strokeWidth={1}
        />
        {/* the solid SSW end block, hatched darker so it reads as mass */}
        <Rect
          x={t.X(p.end_block_x[0])}
          y={t.Y(p.y_min)}
          width={(p.end_block_x[1] - p.end_block_x[0]) * t.k}
          height={(p.y_max - p.y_min) * t.k}
          fill="rgba(255,255,255,0.13)"
        />
        {/* the two wells — the open voids the gallery looks down into */}
        {p.wells.map((wl, i) => (
          <Rect
            key={i}
            x={t.X(wl.x[0])}
            y={t.Y(wl.y[0])}
            width={(wl.x[1] - wl.x[0]) * t.k}
            height={(wl.y[1] - wl.y[0]) * t.k}
            fill="rgba(0,0,0,0.30)"
          />
        ))}
        {/* the pillar grid: what makes the building legible from inside */}
        <G>
          {p.pillar_x.map(mx =>
            p.pillar_y.map(my => (
              <Circle
                key={`${mx}:${my}`}
                cx={t.X(mx)}
                cy={t.Y(my)}
                r={scale > 1 ? 1.7 : 1}
                fill={COLORS.textMuted}
              />
            )),
          )}
        </G>
        {/* the principal (ESE) facade, the side the visitor approaches from */}
        <Line
          x1={t.X(p.x_min)}
          y1={t.Y(p.y_min)}
          x2={t.X(p.x_max)}
          y2={t.Y(p.y_min)}
          stroke={COLORS.amber}
          strokeWidth={1.5}
          strokeOpacity={0.55}
        />
        {wedge ? <Path d={wedge} fill={COLORS.amber} fillOpacity={0.30} /> : null}
        <Circle cx={px} cy={py} r={scale > 1 ? 5 : 3.5} fill={COLORS.amber} />
      </Svg>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: SPACING.lg,
    top: 96,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(10,10,12,0.72)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  title: {
    marginTop: 4,
    maxWidth: W,
    color: COLORS.amberLight,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

export default PalacePlanIndicator;
