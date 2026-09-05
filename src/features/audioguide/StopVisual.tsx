/**
 * StopVisual — the pictures belonging to one audio stop.
 *
 * WHY IT EXISTS. Seven of the palace's eight stops were a voice over a dead
 * panel: a title, a player, a transcript and nothing to look at. The eighth had
 * a restored view that could only be reached by opening a camera. A visitor
 * standing in the building was being told about a scalloped arch above their
 * head and shown a paragraph about it.
 *
 * ONE COMPONENT FOR BOTH DOORS. The journey's guide step and the standalone
 * "Just listen" screen serve the same eight stops, and the standalone screen is
 * the one built for visitors who cannot walk the journey — it must not be the
 * poorer experience. Both render this. Everything here is built on COLORS, which
 * is what journeyStyles is built on too (JourneyUi.tsx:28-31), so it sits inside
 * either surface without a theme prop.
 *
 * ── THE TWO LINES THAT MUST NEVER BE DROPPED ────────────────────────────────
 *
 * THE DISCLOSURE, whenever the picture was made rather than taken. Enforced
 * three deep: `ck_object_media_disclosure` refuses to store a generated row
 * without one, `disclosureFor` refuses to serve one, and this draws it
 * unconditionally. Only one still at this venue is generated — the stair, for
 * which no shippable photograph exists — and it says so.
 *
 * THE CREDIT, whenever it is a photograph. Same three layers, added by migration
 * 097 (`ck_object_media_credit`, `creditFor`, and the line below). This exists
 * because the honour system already failed once here: six CC BY 2.0 photographs
 * ship bundled in the app at src/assets/images/palace-rooms/ and are credited
 * nowhere, behind a comment (roomPhotos.ts:16) asserting that a credits block
 * covers them — a block that names one different file, used for a texture.
 *
 * Four of the photographs shown here are CC BY-SA, which is why they are never
 * cropped and why the credit is a tap through to the Commons page rather than a
 * bare name: the licence asks for a link where that is practicable, and it is.
 *
 * ── THE CAPTIONS ARE NOT SUMMARIES ──────────────────────────────────────────
 *
 * They are a second edition of the narration under the same tier rules, written
 * because written text shortens more easily than spoken text and every hedge in
 * the script is load-bearing. The stop about a hundred and sixty pillars carries
 * no number in its caption at all; the zenana label keeps the instruction to
 * treat it as a label; the ceiling that is CONFIRMED gets no caution added to
 * it. That work is in migration 097, not here — this component renders what the
 * curator wrote and never composes text from `tier` or `source_ids`.
 */
import React from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';

import type { SubjectImage } from '../../shared/hooks/useSubjectMedia';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
} from '../../core/constants/theme';

export interface StopVisualProps {
  /** Stills for this stop, in `sort_order`. Empty renders nothing. */
  images: SubjectImage[];
  /**
   * The stop's restored view, when it has one, already resolved to a URI.
   *
   * Separate from `images` because it is a different KIND of thing and lives in
   * a different place: `audio_stops.restoration_image_url` rather than
   * object_media, and it is a reconstruction of a room rather than a record of
   * one. Only `the_lost_colour` has one.
   */
  restorationUri?: string | null;
  /**
   * The clip's `restoration_caption` — authored prose saying what the
   * reconstruction is evidenced by and which part of it is a guess. Never
   * composed here from tier and sources: those say how confident and from
   * where, not which part of the picture is invented.
   */
  restorationCaption?: string;
  /**
   * Open the camera wipe (RestorationScreen). Omitted where there is no camera
   * path — the reconstruction still SHOWS, it just does not offer the reveal.
   * That is the point of rendering the image here at all: until now the only
   * way to see it was to hold a phone up in the room.
   */
  onOpenRestoration?: () => void;
  /**
   * 'stack' — every picture, full width, each with title, caption, disclosure
   * and credit beneath it. For a scrolling surface: the journey's guide step
   * and the stop sheet.
   *
   * 'hero' — ONE picture, sized to the space it is given, with the disclosure
   * and the credit and nothing else. For the standalone "Just listen" screen,
   * which is a fixed, unscrolling transport: a stack of captioned figures would
   * push the play button off the bottom of it.
   *
   * THE DISCLOSURE AND THE CREDIT SURVIVE THE TRIM. They are the two lines that
   * are owed; the title and the caption are the two that can wait one tap, in
   * the sheet, where the whole stack renders.
   */
  layout?: 'stack' | 'hero';
}

/**
 * Parse '4:3' to a number for `aspectRatio`, falling back to 4/3.
 *
 * A box with no ratio collapses to zero height until the file decodes, which is
 * the layout jump `aspect_ratio` exists to stop. 4/3 rather than 16/9 because
 * seven of this venue's nine stills are 4:3 — a wrong guess that is usually
 * right costs one reflow instead of eight.
 */
function ratioOf(raw: string | null | undefined): number {
  if (!raw) return 4 / 3;
  const [w, h] = raw.split(':').map(Number);
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return 4 / 3;
  return w / h;
}

/** One picture and everything that is owed alongside it. */
const Figure: React.FC<{
  uri: string;
  ratio: number;
  title?: string;
  caption?: string;
  disclosure?: string;
  credit?: string;
  creditUrl?: string;
  accessibilityLabel: string;
}> = ({
  uri,
  ratio,
  title,
  caption,
  disclosure,
  credit,
  creditUrl,
  accessibilityLabel,
}) => (
  <View style={styles.figure}>
    <Image
      source={{ uri }}
      style={[styles.image, { aspectRatio: ratio }]}
      resizeMode="cover"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    />
    {title ? <Text style={styles.title}>{title}</Text> : null}
    {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    {/* NOT COLLAPSED, NOT BEHIND A TAP. A generated picture that plays without
        its disclosure is the exact failure the schema was built to prevent. */}
    {disclosure ? <Text style={styles.disclosure}>{disclosure}</Text> : null}
    {credit ? (
      creditUrl ? (
        <Pressable
          onPress={() => {
            void Linking.openURL(creditUrl);
          }}
          accessibilityRole="link"
          accessibilityLabel={credit}>
          <Text style={[styles.credit, styles.creditLink]}>{credit}</Text>
        </Pressable>
      ) : (
        <Text style={styles.credit}>{credit}</Text>
      )
    ) : null}
  </View>
);

const StopVisual: React.FC<StopVisualProps> = ({
  images,
  restorationUri,
  restorationCaption,
  onOpenRestoration,
  layout = 'stack',
}) => {
  const { t } = useTranslation();
  // EMPTY RENDERS NOTHING — no tray, no "no image" line, no reserved space. A
  // venue seeded ahead of its pictures looks exactly as it did before.
  if (images.length === 0 && !restorationUri) return null;

  if (layout === 'hero') {
    // The restored view wins the slot where a stop has one: it is the picture
    // that stop is ABOUT. Everything else, and every other image, is in the
    // sheet a tap away.
    const hero = images[0];
    const uri = restorationUri || hero?.imageUrl;
    if (!uri) return null;
    return (
      <View style={styles.hero}>
        <Image
          source={{ uri }}
          style={styles.heroImage}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            restorationUri ? t('restoration.imageTitle') : hero?.title ?? ''
          }
        />
        {restorationUri ? (
          restorationCaption ? (
            <Text style={styles.disclosure} numberOfLines={3}>
              {restorationCaption}
            </Text>
          ) : null
        ) : (
          <>
            {hero.disclosure ? (
              <Text style={styles.disclosure} numberOfLines={3}>
                {hero.disclosure}
              </Text>
            ) : null}
            {hero.credit ? (
              <Text style={styles.credit}>{hero.credit}</Text>
            ) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {images.map(img => (
        <Figure
          key={img.id}
          uri={img.imageUrl}
          ratio={ratioOf(img.aspectRatio)}
          title={img.title}
          caption={img.caption}
          disclosure={img.disclosure}
          credit={img.credit}
          creditUrl={img.creditUrl}
          accessibilityLabel={img.title || img.caption || ''}
        />
      ))}

      {/* THE RESTORED VIEW, SHOWN RATHER THAN PROMISED. It used to be a button
          that opened a camera; the picture is the evidence and the wipe is a
          way of enjoying it, so the picture comes first and the wipe follows.
          Its caption is the disclosure — the row is a reconstruction, and the
          prose the curator wrote for it says which part is inference. */}
      {restorationUri ? (
        <View style={styles.figure}>
          <Image
            source={{ uri: restorationUri }}
            style={[styles.image, styles.restoration]}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('restoration.cta')}
          />
          <Text style={styles.title}>{t('restoration.imageTitle')}</Text>
          {restorationCaption ? (
            <Text style={styles.disclosure}>{restorationCaption}</Text>
          ) : null}
          {onOpenRestoration ? (
            <Pressable
              onPress={onOpenRestoration}
              accessibilityRole="button"
              accessibilityLabel={t('restoration.wipeCta')}
              style={styles.wipeBtn}>
              <Sparkles size={16} color={COLORS.gold} />
              <Text style={styles.wipeText}>{t('restoration.wipeCta')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: SPACING.lg },
  hero: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.xs,
    justifyContent: 'center',
  },
  // `contain` and a flexible box: the stills are 4:3, 3:2 and 16:9, and this
  // slot is whatever the transport leaves behind on the phone in the visitor's
  // hand. Cropping to fill would cut the top off a soffit or the date off a
  // board, which on `what_the_board_says` would remove the entire point.
  heroImage: { flex: 1, width: '100%', borderRadius: RADIUS.md },
  figure: { gap: SPACING.xs },
  image: {
    width: '100%',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgWarm,
  },
  // 3:4 portrait, the crop the restoration was produced at.
  restoration: { aspectRatio: 3 / 4 },
  title: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.small,
    marginTop: SPACING.xs,
  },
  caption: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.small,
    lineHeight: 21,
  },
  disclosure: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.caption,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  credit: {
    color: COLORS.textTertiary,
    fontFamily: FONTS.ui,
    fontSize: FONT_SIZES.caption,
  },
  creditLink: { textDecorationLine: 'underline' },
  wipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderFocus,
    marginTop: SPACING.xs,
  },
  wipeText: {
    color: COLORS.gold,
    fontFamily: FONTS.uiSemiBold,
    fontSize: FONT_SIZES.small,
  },
});

export default StopVisual;
