/**
 * VideoStrip — the authored video attached to a stop or a figure, offered as
 * posters.
 *
 * POSTER FIRST, ALWAYS. Nothing here is a `<Video>`; it is an `<Image>` of the
 * poster frame with a play badge over it, and the clip only ever plays after a
 * deliberate tap. Autoplaying video under a narration track would put two voices
 * in the room at once, and autoplaying it silently would be a moving decoration
 * that costs a visitor their data for nothing.
 *
 * THE DISCLOSURE IS DRAWN WITH THE VIDEO, NOT BEHIND IT. `object_media` carries
 * a CHECK that refuses to store a generated asset without one (migration 090),
 * `useSubjectMedia` refuses to hand one back without one, and this is where it
 * is shown. Never collapsed, never behind a disclosure triangle, never a tap
 * away.
 *
 * WHERE it is shown depends on `variant`, and the two are not the same promise
 * weakened — they are the same promise placed where the surface allows:
 *   - 'full' draws it under the poster BEFORE the tap, so a visitor knows what
 *     they are about to watch rather than finding out afterwards.
 *   - 'compact' has a 116 px column and no room for a sentence, so the string
 *     travels to FullscreenVideo, which draws it over the foot of the playing
 *     video. Nothing plays without passing through that component.
 * In 'full' it therefore appears twice, which is the right way round: the
 * surface with the space is the surface that warns first.
 *
 * IT DOES NOT OWN THE PLAYER. Tapping calls `onOpen`; the host screen renders
 * `FullscreenVideo` above everything and — the reason the split exists — knows
 * to suspend its own audio while it is up. A strip that opened its own overlay
 * would be clipped inside a ScrollView and would have no way to reach the
 * narration it needs to pause. This mirrors PointLearnScreen's existing
 * `onOpenVideo` arrangement rather than inventing a second one.
 *
 * EMPTY IS NORMAL AND EMPTY RENDERS NOTHING. Seven of the palace's eight stops
 * have no video. There is no tray, no "no media" line, no reserved space.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react-native';

import type { SubjectVideo } from '../../../shared/hooks/useSubjectMedia';
import {
  JOURNEY_GOLD,
  JOURNEY_TEXT,
  JOURNEY_TEXT_MUTED,
  journeyStyles,
} from './JourneyUi';

interface Props {
  videos: SubjectVideo[];
  /** Tapped a poster. The host opens FullscreenVideo and suspends its audio. */
  onOpen: (video: SubjectVideo) => void;
  /**
   * 'full' — stacked, full-width posters with title, caption and disclosure
   * beneath each. For a text surface with room, like the guide step.
   *
   * 'compact' — one scrolling row of small posters with the title only. For the
   * magic window, where the screen IS the reconstruction and a full-width
   * poster stack would bury the building the visitor came to look at.
   *
   * THE DISCLOSURE IS NOT LOST IN 'compact'. It moves to the player:
   * FullscreenVideo takes the same string and draws it over the foot of the
   * video, and `useSubjectMedia` never yields a generated row without one. So
   * the guarantee holds in both variants — in 'full' it is shown twice, before
   * the tap and during playback, which is the right way round for the surface
   * that has the space.
   */
  variant?: 'full' | 'compact';
}

/**
 * Parse '16:9' to a number for `aspectRatio`. Falls back to 16/9 rather than to
 * nothing: a box with no ratio collapses to zero height until the poster
 * decodes, which is exactly the layout jump `aspect_ratio` was added to stop.
 */
function ratioOf(raw: string | null): number {
  if (!raw) return 16 / 9;
  const [w, h] = raw.split(':').map(Number);
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return 16 / 9;
  return w / h;
}

const VideoStrip: React.FC<Props> = ({ videos, onOpen, variant = 'full' }) => {
  const { t } = useTranslation();
  if (videos.length === 0) return null;

  const compact = variant === 'compact';

  const items = videos.map(video => (
    <Pressable
      key={video.id}
      style={compact ? styles.compactItem : styles.item}
      onPress={() => onOpen(video)}
      accessibilityRole="button"
      accessibilityLabel={`${t('journey.explore.watch')}: ${video.title}`}>
      <View
        style={[
          styles.frame,
          { aspectRatio: ratioOf(video.aspectRatio) },
          compact && styles.compactFrame,
        ]}>
        {video.posterUrl ? (
          <Image
            source={{ uri: video.posterUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}
        <View style={compact ? styles.compactBadge : styles.badge}>
          <Play
            color={JOURNEY_GOLD}
            size={compact ? 13 : 18}
            fill={JOURNEY_GOLD}
          />
        </View>
      </View>

      {video.title ? (
        <Text
          style={compact ? styles.compactTitle : styles.title}
          numberOfLines={compact ? 2 : undefined}>
          {video.title}
        </Text>
      ) : null}
      {!compact && video.caption ? (
        <Text style={journeyStyles.caption}>{video.caption}</Text>
      ) : null}
      {/* 'full' only — see the `variant` doc: in 'compact' this string travels
          to FullscreenVideo instead, so it is never simply dropped. */}
      {!compact && video.disclosure ? (
        <Text style={styles.disclosure}>{video.disclosure}</Text>
      ) : null}
    </Pressable>
  ));

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactRow}
        style={styles.compactScroll}>
        {items}
      </ScrollView>
    );
  }

  return <View style={styles.root}>{items}</View>;
};

const styles = StyleSheet.create({
  root: { gap: 18 },
  item: { gap: 6 },
  frame: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.66)',
    borderWidth: 1,
    borderColor: JOURNEY_GOLD,
  },
  title: {
    color: JOURNEY_TEXT,
    fontSize: 15,
    fontWeight: '600',
  },
  disclosure: {
    color: JOURNEY_TEXT_MUTED,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  compactScroll: { flexGrow: 0 },
  compactRow: { gap: 10, paddingVertical: 2 },
  compactItem: { width: 116, gap: 4 },
  compactFrame: { borderRadius: 10 },
  compactBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,12,0.66)',
    borderWidth: 1,
    borderColor: JOURNEY_GOLD,
  },
  compactTitle: {
    color: JOURNEY_TEXT,
    fontSize: 12,
    lineHeight: 16,
  },
});

export default VideoStrip;
