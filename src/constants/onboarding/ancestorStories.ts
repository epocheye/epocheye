/**
 * Ancestor Stories
 * Region-specific stories for the FirstTaste onboarding screen.
 * Each story follows the same emotional structure:
 * name → year → action → legacy connection to the present.
 */

export const ANCESTOR_STORIES: Record<string, string> = {
  Odisha:
    'In 1250 AD, a stone carver named Arjuna from coastal Kalinga walked 40 miles to work on the Sun Temple\'s chariot wheel. He would never see it completed. But his hands shaped the stone you\'re touching right now.',

  Rajasthan:
    'In 1459, a mason named Lakha carried sandstone blocks up the cliff face of Mehrangarh. He sang to keep rhythm with the others. The fort still stands because men like him refused to stop climbing.',

  Bengal:
    'In 1605, a terracotta artist named Kamala pressed wet clay into temple walls in Bishnupur. She carved dancers that would outlast empires. Six hundred monsoons later, her figures still move in the rain.',

  Punjab:
    'In 1604, a scribe named Bhai Mani Singh copied sacred verses by lamplight inside the Golden Temple. His ink faded but the words endured. Every prayer spoken there carries the weight of his hand.',

  'Tamil Nadu':
    'In 1010 AD, a bronze caster named Selvan poured molten metal into the mold of a dancing Shiva at Chola\'s great temple. The figure cooled overnight. A thousand years later, it still dances.',

  Kerala:
    'In 1568, a woodcarver named Kannan shaped teak beams for the Padmanabhapuram Palace. He carved lotus petals so thin that light passed through them. His ceiling still shelters those who look up in wonder.',

  Maharashtra:
    'In the 2nd century BC, a monk named Devadatta chiseled into volcanic basalt at Ajanta. He carved a prayer hall by torchlight over twenty years. The cave he hollowed still echoes with silence.',

  Persia:
    'In 515 BC, a stonecutter named Dariush carved winged bulls into the gates of Persepolis. He worked until his chisel wore flat. The bulls still guard the entrance to a kingdom that fell long ago.',

  China:
    'In 676 AD, a sculptor named Wei Liang carved a Buddha\'s face into the limestone cliffs of Longmen. He polished each eyelid until it held compassion. Fourteen centuries later, the Buddha still watches the river.',

  'West Africa':
    'In 1235, a griot named Sundiata\'s keeper memorized the entire lineage of the Mali Empire. He spoke it aloud at the walls of Timbuktu. The mud bricks crumbled, but the story never broke.',

  'The Ottomans':
    'In 1557, a tile maker named Mehmed pressed cobalt and turquoise glaze onto ceramic for the Süleymaniye Mosque. Each tile took three firings. The blues he mixed still glow when morning light enters.',

  Mesopotamia:
    'In 575 BC, a bricklayer named Nabu-kudurri pressed glazed bricks into the Ishtar Gate of Babylon. He set each dragon scale by hand. The gate fell, was unearthed, and his dragons still roar in blue.',
};

/**
 * Default story shown when no region is selected or region is null
 */
export const DEFAULT_STORY_REGION = 'Odisha';

/**
 * Monument data associated with the default story
 */
export const MONUMENT_DATA = {
  name: 'Konark Sun Temple',
  year: '1250 AD',
} as const;
