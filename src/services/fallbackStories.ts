/**
 * Fallback ancestor stories for when the API call fails.
 * One story per region matching OB05 regions.
 * User never sees an error — these load silently.
 *
 * Stories deliberately avoid hardcoded monument names in their prose.
 * When the caller knows the active monument (Lens, AR experience), it
 * passes `siteName` and the story uses it for the monument return
 * field; without one, a neutral fallback ("this place") keeps the
 * narration grammatical.
 */

interface FallbackStoryFn {
  (firstName: string, siteName: string): {
    story: string;
    monument: string;
    year: string;
  };
}

const FALLBACK_STORIES: Record<string, FallbackStoryFn> = {
  'South Asia': (name, siteName) => ({
    story: `In 1250 AD, a stone carver named ${name} walked forty miles along the coast of Kalinga to reach a great temple rising from the sand. For three years, they carved a single chariot wheel into its eastern wall — a wheel so precise it still tells time by shadow. Merchants from across the Indian Ocean would navigate by the silhouette on the horizon. ${name}'s wheel outlasted empires, monsoons, and centuries of forgetting. It waits there still, turning with the sun.`,
    monument: siteName,
    year: '1250 AD',
  }),
  'Africa': (name, siteName) => ({
    story: `In the 12th century, a master builder named ${name} joined the carving of sanctuaries hewn into the rock below the Ethiopian highlands. Working by torchlight, they chiseled living stone into sacred geometry. Each strike of the chisel was a prayer. The deepest church, carved from a single block of stone, still stands as a testament to faith shaped from the earth itself. ${name}'s hands shaped what the world would call a wonder.`,
    monument: siteName,
    year: '12th Century',
  }),
  'East Asia & Pacific': (name, siteName) => ({
    story: `In 676 AD, a sculptor named ${name} stood before a cliff face above the river, carving the serene expression of a great Buddha. Each morning they climbed bamboo scaffolding fifty feet above the water, working stone that would outlast dynasties. The Buddha's faint smile — some say it mirrors an empress's own — has watched over the river for thirteen centuries. ${name}'s chisel marks are still visible in the limestone.`,
    monument: siteName,
    year: '676 AD',
  }),
  'Europe': (name, siteName) => ({
    story: `In 1163, a young mason named ${name} laid the first stones of a great cathedral on an island in the river at the heart of the city. They spent a lifetime perfecting flying buttresses that let light pour through rose windows. ${name} never saw the cathedral finished — it took nearly two centuries — but the western facade bears the mark of their distinctive chisel pattern. Eight hundred years of worship, revolution, and fire have not erased what ${name} built.`,
    monument: siteName,
    year: '1163',
  }),
  'Americas': (name, siteName) => ({
    story: `In 600 AD, an astronomer named ${name} aligned a great pyramid so precisely that every equinox, the setting sun casts a shadow of a serpent descending the northern staircase. ${name} calculated this alignment using only observation and memory passed down through generations. Twice a year, travellers gather to watch the serpent descend — never knowing they are witnessing ${name}'s final calculation made fifteen centuries ago.`,
    monument: siteName,
    year: '600 AD',
  }),
  'Middle East & Central Asia': (name, siteName) => ({
    story: `In 515 BC, a stonecutter named ${name} carved winged bulls into the gates of a ceremonial capital. They worked alongside artisans from twenty-three nations — each bringing their own craft to a ruler's great hall. ${name}'s bulls guarded a gate where ambassadors from across the known world entered bearing tribute. The ruins still echo with the footsteps of those who passed beneath ${name}'s watchful guardians.`,
    monument: siteName,
    year: '515 BC',
  }),
  'Southeast Asia': (name, siteName) => ({
    story: `In the 9th century, a sculptor named ${name} carved apsara dancers into the sandstone walls of a great temple complex. Working through monsoon seasons, they depicted celestial beings with such grace that the stone seems to breathe. Over two thousand unique apsaras adorn the temple — and ${name}'s are among the most celebrated, recognisable by the distinctive curve of their headdresses. The jungle has tried to reclaim the temple many times, but ${name}'s dancers still emerge from the stone.`,
    monument: siteName,
    year: '9th Century',
  }),
};

export function getFallbackStory(
  region: string,
  firstName: string,
  siteName?: string | null,
): {story: string; monument: string; year: string} {
  const generator = FALLBACK_STORIES[region] ?? FALLBACK_STORIES['South Asia'];
  const safeSite = siteName?.trim() || 'this place';
  return generator(firstName, safeSite);
}
