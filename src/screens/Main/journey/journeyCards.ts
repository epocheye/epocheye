/**
 * Card JSON for the journey's point-and-learn placards.
 *
 * The shape is the one DetectArScreen's buildArCards / buildGroundedArCards
 * emit and the native renderer reads (EpocheyeArCardRenderer.kt: display_name,
 * period/dynasty/material/origin, narrative, continuation, heading — and, for a
 * video card, video_url / poster_url / id). Those builders are module-private
 * to DetectArScreen, so the splitting and capping rules are mirrored here
 * rather than imported; keep the two in step.
 *
 * Nothing here carries per-card source or confidence wording. identity_confidence
 * is backend telemetry the renderer deliberately never draws (hard rule 2); the
 * journey's disclaimer says once where the history and the storytelling come from.
 */
import type { ObjectCard } from '../../../services/detectorResolver';

/**
 * Upper bound on world-anchored placards — lock-step with the native
 * cardLayoutFor(n) cap so JS never emits more cards than the AR view places.
 */
export const MAX_AR_CARDS = 6;

/** Stable id of the dev-only video card so its tap is recognisable in logs. */
export const JOURNEY_VIDEO_CARD_ID = 'journey_video';

/** One placard as the native renderer reads it. */
export type ArCard = Record<string, unknown>;

/**
 * Split narration into COMPLETE sections for AR cards — one coherent block per
 * card, never a mid-sentence cut. Paragraph breaks first, then whole sentences
 * packed into ~`targetLen`-char groups; any overflow past `maxSections` is
 * merged into the last section so no text is ever dropped.
 */
export function splitIntoSections(
  raw: string | null | undefined,
  targetLen = 320,
  maxSections = MAX_AR_CARDS,
): string[] {
  const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  const sections: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= targetLen) {
      sections.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para];
    let buf = '';
    for (const s of sentences) {
      const sentence = s.trim();
      if (!sentence) continue;
      if (buf && buf.length + 1 + sentence.length > targetLen) {
        sections.push(buf);
        buf = sentence;
      } else {
        buf = buf ? `${buf} ${sentence}` : sentence;
      }
    }
    if (buf) sections.push(buf);
  }

  if (sections.length === 0) return [text];
  if (sections.length > maxSections) {
    return [
      ...sections.slice(0, maxSections - 1),
      sections.slice(maxSections - 1).join(' '),
    ];
  }
  return sections;
}

/**
 * Fold any cards past `max` into the last kept card (narratives joined with a
 * blank line) — never drop content, never exceed what native will place.
 */
export function capCards(cards: ArCard[], max = MAX_AR_CARDS): ArCard[] {
  if (cards.length <= max) return cards;
  const tail = cards.slice(max - 1);
  const mergedNarrative = tail
    .map(c => (typeof c.narrative === 'string' ? c.narrative : ''))
    .filter(Boolean)
    .join('\n\n');
  return [...cards.slice(0, max - 1), { ...tail[0], narrative: mergedNarrative }];
}

/**
 * Cards for an AI interpretation: card 0 carries the name + first section, each
 * further section is a body-only continuation. Card count follows the text.
 */
export function buildAiCards(name: string, body: string): ArCard[] {
  const sections = splitIntoSections(body);
  if (sections.length === 0) {
    return [{ display_name: name, identity_confidence: 'inferred', narrative: body }];
  }
  return sections.map((section, i) =>
    i === 0
      ? { display_name: name, identity_confidence: 'inferred', narrative: section }
      : { continuation: true, narrative: section },
  );
}

/**
 * Cards for a grounded monument_objects row: an identity card (name + meta +
 * first narrative section), further narrative sections, a headed
 * "What to look for" card from the iconography, and one headed card per
 * context layer. Capped like DetectArScreen's builder.
 */
export function buildGroundedCards(card: ObjectCard): ArCard[] {
  const cards: ArCard[] = [];

  const narrativeSections = splitIntoSections(card.narrative);
  cards.push({
    display_name: card.display_name,
    identity_confidence: card.identity_confidence,
    period: card.period,
    dynasty: card.dynasty,
    material: card.material,
    origin: card.origin,
    narrative: narrativeSections[0] ?? '',
  });
  for (const section of narrativeSections.slice(1)) {
    cards.push({ continuation: true, narrative: section });
  }

  const iconSections = splitIntoSections(card.iconography);
  iconSections.forEach((section, i) => {
    cards.push({
      continuation: true,
      ...(i === 0 ? { heading: 'What to look for' } : {}),
      narrative: section,
    });
  });

  for (const layer of card.context_layers ?? []) {
    const layerBody = (layer.body ?? '').trim();
    if (!layerBody) continue;
    cards.push({ continuation: true, heading: layer.label, narrative: layerBody });
  }

  return capCards(cards);
}

/**
 * True when the recognised title names a pillar — the trigger for the dev-only
 * video hook below. Case-insensitive, matches "pillar" and "pillars".
 */
export function titleMentionsPillar(title: string | null | undefined): boolean {
  return /\bpillars?\b/i.test(title ?? '');
}

/** One video row, as a card wants it. Built from an object_media row. */
export interface VideoCardSpec {
  /** Resolved, playable URL — cache path or remote. */
  videoUrl: string;
  /** The row's own title, which is per-video and not the object's name. */
  title: string;
  posterUrl?: string | null;
  disclosure?: string;
}

/**
 * How many of an object's videos can become cards.
 *
 * MAX_AR_CARDS - 2, so at least two text placards always survive. An object
 * with more videos than this drops the tail rather than the words: the text is
 * what the card is FOR, and a wall of silent video quads with no explanation is
 * a worse outcome than a clip the visitor does not get.
 */
export const MAX_VIDEO_CARDS = MAX_AR_CARDS - 2;

/**
 * Stable id for the i-th video card. Index 0 keeps the bare id so existing log
 * greps and taps still read, later ones are suffixed 1-based-plus-one.
 */
export function videoCardId(i: number): string {
  return i === 0 ? JOURNEY_VIDEO_CARD_ID : `${JOURNEY_VIDEO_CARD_ID}_${i + 1}`;
}

/**
 * Attach EVERY video an object has, not just the first.
 *
 * WHY PLURAL. This was `withDevVideoCard`, singular, from when the only thing
 * feeding it was a colour-bar test pattern. object_media (migration 090) holds
 * a LIST per class_id, and migration 093 seeds two videos each on the palace's
 * sword and hilt: under the singular version those second rows existed, served
 * from the CDN, and could never appear. The name also outlived its truth —
 * nothing about this is dev-only any more.
 *
 * Each video is its OWN placard, because it renders as a video quad rather than
 * a text placard. Each carries a heading + narrative so that, if native cannot
 * build the player, the fallback reads "Watch / <title>" instead of "Unknown
 * object" — and the narrative is the ROW's title, not the object's, so two
 * clips on one object do not both say the same thing.
 *
 * The disclosure test is PER VIDEO and deliberately not hoisted: a generated
 * row without its disclosure must be dropped on its own, without taking a
 * legitimate sibling with it.
 *
 * The whole set stays within MAX_AR_CARDS by folding text overflow first.
 */
export function withVideoCards(
  cards: ArCard[],
  videos: ReadonlyArray<VideoCardSpec>,
  watchLabel: string,
): ArCard[] {
  // THE PILLAR TEST NO LONGER GATES REAL MEDIA. It was the dev hook's way of
  // limiting a colour-bar test pattern to one harmless subject. Media that came
  // from object_media was authored against this exact object, so gating it on
  // the word "pillar" would hide every real clip. The dev pattern still passes
  // through the same check, because JOURNEY_TEST_VIDEO_URL is the only thing
  // that reaches here without a disclosure or a title of its own.
  const usable = videos.filter(
    v => !!v.videoUrl && (!!v.disclosure || titleMentionsPillar(v.title)),
  );
  if (usable.length === 0) return cards;

  const shown = usable.slice(0, MAX_VIDEO_CARDS);
  if (__DEV__ && shown.length < usable.length) {
    console.warn(
      `[journeyCards] ${usable.length - shown.length} video(s) dropped: ` +
        `${usable.length} on this object, ${MAX_VIDEO_CARDS} can be shown`,
    );
  }

  const videoCards: ArCard[] = shown.map((v, i) => ({
    id: videoCardId(i),
    continuation: true,
    heading: watchLabel,
    narrative: v.title,
    video_url: v.videoUrl,
    ...(v.posterUrl ? { poster_url: v.posterUrl } : {}),
    // Carried on the card itself so the renderer cannot draw the video without
    // it. A generated asset that reached here has a non-empty disclosure by
    // construction: the DB refuses to store one without (migration 090) and
    // PointLearnStep drops the video if it is somehow missing.
    ...(v.disclosure ? { disclosure: v.disclosure } : {}),
  }));

  return [
    ...capCards(cards, MAX_AR_CARDS - videoCards.length),
    ...videoCards,
  ];
}
