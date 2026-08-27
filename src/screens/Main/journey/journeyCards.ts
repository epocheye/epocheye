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

/**
 * DEV-ONLY HOOK — attach a video card so the VideoNode path (video playing ON a
 * world-anchored card, tap-to-enlarge) can be exercised before any real card
 * video exists. No backend schema carries a video yet; when it does, the
 * recognise result's own `video_url` replaces this and the pillar test goes.
 *
 * The video card is appended as its OWN placard (it renders as a video quad,
 * not a text placard), so the text cards keep their content. It carries a
 * heading + narrative so that, if native cannot build the player, the fallback
 * placard reads "Watch / <title>" rather than "Unknown object". The whole set
 * stays within MAX_AR_CARDS by folding text overflow first.
 */
export function withDevVideoCard(
  cards: ArCard[],
  title: string,
  videoUrl: string | null,
  watchLabel: string,
  posterUrl?: string | null,
): ArCard[] {
  if (!videoUrl || !titleMentionsPillar(title)) return cards;
  const videoCard: ArCard = {
    id: JOURNEY_VIDEO_CARD_ID,
    continuation: true,
    heading: watchLabel,
    narrative: title,
    video_url: videoUrl,
    ...(posterUrl ? { poster_url: posterUrl } : {}),
  };
  return [...capCards(cards, MAX_AR_CARDS - 1), videoCard];
}
