/**
 * Everything that is not the reconstruction.
 *
 * WHY THIS EXISTS. The magic window rendered twenty text elements and eight
 * controls over the thing the visitor came to look at: the legend and its three
 * details, the plan, the image credits, the viewpoint rail, the caption, the
 * progress, the guide and a permanent line of instructions. Each was defensible
 * on its own and the sum was a form with a reconstruction behind it.
 *
 * None of it is deleted. Removing the ability to reach the evidence would be a
 * different and worse product than a cluttered one — the legend is what tells a
 * visitor which parts of the building are confirmed and which are an idiom, and
 * the credits are a licence obligation, not a nicety. It all moved behind one
 * tap.
 *
 * THE SHELL IS SHARED. The slide, the grabber, the close target and the
 * always-mounted behaviour live in components/ui/DetailSheet, because the audio
 * guide now makes the same move for the same reason. What stays here is only
 * what is specific to a reconstruction: the plan, the legend, the room
 * photographs, the credits.
 */

import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PalacePlanIndicator from './PalacePlanIndicator';
import {roomPhotoFor} from './roomPhotos';
import {TEXTURE_CREDITS} from './palace';
import type {MagicWindowScene} from './scenes';
import type {MagicWindowViewpoint} from './viewpoints';
import DetailSheet, {SHEET} from '../../components/ui/DetailSheet';
import {COLORS, FONTS, RADIUS, SPACING} from '../../core/constants/theme';

export interface MagicWindowSheetProps {
  open: boolean;
  onClose: () => void;
  scene: MagicWindowScene;
  viewpoint: MagicWindowViewpoint;
  /** Index into `scene.viewpoints`, for the rail's active chip. */
  index: number;
  onSelectViewpoint: (next: number) => void;
  /** Compass heading of the view, for the plan's facing wedge. */
  headingDeg: number | null;
  /** The current stop's spoken text, when there is a clip behind this stop. */
  transcript?: string;
  /** The single mounted <AudioPlayer/>. Full transport lives here. */
  player?: React.ReactNode;
  /** Scene-specific extras: the fort's timeline and assault sequence. */
  children?: React.ReactNode;
}

const MagicWindowSheet: React.FC<MagicWindowSheetProps> = ({
  open,
  onClose,
  scene,
  viewpoint,
  index,
  onSelectViewpoint,
  headingDeg,
  transcript,
  player,
  children,
}) => {
  return (
    <DetailSheet open={open} onClose={onClose} closeLabel="Close details">
        {/* THE PLAYER. Scrub, speed and skip live here; the reconstruction
            keeps only a play/pause glyph, because that is the one control a
            visitor needs without looking. */}
        {player ? <View style={SHEET.block}>{player}</View> : null}

        {/* WHERE YOU ARE, drawn rather than named. */}
        {scene.hasPlanIndicator ? (
          <View style={SHEET.block}>
            <Text style={SHEET.heading}>Where you are standing</Text>
            <PalacePlanIndicator
              inline
              expanded
              position={viewpoint.position}
              headingDeg={headingDeg}
              title={viewpoint.title}
              onToggle={() => {}}
            />
          </View>
        ) : null}

        {/* THE STOP, in full. The caption moved off the reconstruction because
            it restates what the narration is already saying; here it is
            something to read rather than something in the way. */}
        <View style={SHEET.block}>
          <Text style={SHEET.heading}>{viewpoint.title}</Text>
          {viewpoint.facing ? (
            <Text style={SHEET.meta}>Looking {viewpoint.facing}</Text>
          ) : null}
          <Text style={SHEET.text}>{viewpoint.caption}</Text>
        </View>

        {/* THE EVIDENCE TIERS. What is confirmed, what is reconstructed, and
            what no source records — the honesty of the whole reconstruction. */}
        <View style={SHEET.block}>
          <Text style={SHEET.heading}>What you are looking at</Text>
          {scene.legend.map(item => (
            <View key={item.key} style={styles.legendItem}>
              <View
                style={[
                  styles.legendSwatch,
                  item.key === 'ghost' && styles.legendSwatchGhost,
                  item.key === 'open' && styles.legendSwatchOpen,
                  item.key === 'colour' && styles.legendSwatchGhost,
                  item.key === 'unknown' && styles.legendSwatchOpen,
                ]}
              />
              <View style={styles.legendText}>
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* MOVE. A list of place names cannot be matched to a room you are
            standing in, which is why the tour leads instead - but this is how
            you revisit a room out of order, and the photographs are what make
            a name matchable at all. */}
        <View style={SHEET.block}>
          <Text style={SHEET.heading}>Go to a place</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}>
            {scene.viewpoints.map((vp, i) => {
              const active = i === index;
              const photo = roomPhotoFor(scene.slug, vp.id);
              return (
                <Pressable
                  key={vp.id}
                  onPress={() => onSelectViewpoint(i)}
                  style={[
                    styles.chip,
                    !!photo && styles.chipWithPhoto,
                    active && styles.chipActive,
                  ]}>
                  {photo ? (
                    <Image source={photo} style={styles.chipPhoto} />
                  ) : null}
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}>
                    {vp.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* THE WORDS. Available, not default - the visitor is meant to be
            looking at the building, not reading along with it. */}
        {transcript ? (
          <View style={SHEET.block}>
            <Text style={SHEET.heading}>Transcript</Text>
            <Text style={SHEET.text}>{transcript}</Text>
          </View>
        ) : null}

        {/* Scene extras: the fort's siege timeline and assault sequence. */}
        {children}

        {/* A LICENCE OBLIGATION, not a nicety. The painted wall ships as a
            photograph of the real surface under CC BY 2.0. */}
        {scene.hasPlanIndicator && TEXTURE_CREDITS.length > 0 ? (
          <View style={SHEET.block}>
            <Text style={SHEET.heading}>Image credits</Text>
            {TEXTURE_CREDITS.map(c => (
              <Text key={c.source} style={styles.credit}>
                {`${c.used_for} — photograph by ${c.author}, ${c.licence}`}
              </Text>
            ))}
          </View>
        ) : null}
    </DetailSheet>
  );
};

const styles = StyleSheet.create({
  legendItem: {flexDirection: 'row', marginBottom: SPACING.sm},
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginTop: 3,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.textPrimary,
  },
  legendSwatchGhost: {backgroundColor: 'rgba(212,134,10,0.55)'},
  legendSwatchOpen: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  legendText: {flex: 1},
  legendLabel: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.uiSemiBold,
    fontSize: 13,
    marginBottom: 2,
  },
  legendDetail: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: 12,
    lineHeight: 18,
  },
  rail: {gap: SPACING.sm, paddingVertical: SPACING.xs},
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    minWidth: 96,
  },
  chipWithPhoto: {paddingTop: SPACING.xs},
  chipActive: {borderColor: COLORS.amber},
  chipPhoto: {
    width: 88,
    height: 58,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  chipTextActive: {color: COLORS.amber},
  credit: {
    color: COLORS.textMuted,
    fontFamily: FONTS.ui,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
});

/**
 * MEMOISED for the same reason as PalacePlanIndicator: the sheet is always
 * mounted (the player lives inside it), so it re-rendered on every heading
 * event even while closed and untouched.
 */
export default React.memo(MagicWindowSheet);
