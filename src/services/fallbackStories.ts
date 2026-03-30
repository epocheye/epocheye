/**
 * Fallback ancestor stories for when the API call fails.
 * One story per region matching OB05 regions.
 * User never sees an error — these load silently.
 */

const FALLBACK_STORIES: Record<string, (name: string) => {story: string; monument: string; year: string}> = {
  'South Asia': (name) => ({
    story: `In 1250 AD, a stone carver named ${name} walked forty miles along the coast of Kalinga to reach the great temple rising from the sand. For three years, they carved a single chariot wheel into the eastern wall of the Konark Sun Temple — a wheel so precise it still tells time by shadow. Merchants from across the Indian Ocean would navigate by the temple's silhouette. ${name}'s wheel outlasted empires, monsoons, and centuries of forgetting. It waits there still, turning with the sun.`,
    monument: 'Konark Sun Temple',
    year: '1250 AD',
  }),
  'Africa': (name) => ({
    story: `In the 12th century, a master builder named ${name} joined the construction of the rock-hewn churches of Lalibela. Working by torchlight deep below the Ethiopian highlands, they chiseled living rock into sacred geometry. Each strike of the chisel was a prayer. The Church of St. George, carved from a single block of stone, still stands as a testament to faith carved from the earth itself. ${name}'s hands shaped what the world would call the Eighth Wonder.`,
    monument: 'Rock-Hewn Churches of Lalibela',
    year: '12th Century',
  }),
  'East Asia & Pacific': (name) => ({
    story: `In 676 AD, a sculptor named ${name} stood before a cliff face at Longmen, carving the serene expression of the Vairocana Buddha. Each morning they climbed bamboo scaffolding fifty feet above the Yi River, working stone that would outlast dynasties. The Buddha's faint smile — some say it mirrors Empress Wu Zetian's own — has watched over the river for thirteen centuries. ${name}'s chisel marks are still visible in the limestone.`,
    monument: 'Longmen Grottoes',
    year: '676 AD',
  }),
  'Europe': (name) => ({
    story: `In 1163, a young mason named ${name} laid the first stones of Notre-Dame de Paris on the Île de la Cité. They spent a lifetime perfecting flying buttresses that let light pour through rose windows. ${name} never saw the cathedral finished — it took nearly two centuries — but the western facade bears the mark of their distinctive chisel pattern. Eight hundred years of worship, revolution, and fire have not erased what ${name} built.`,
    monument: 'Notre-Dame de Paris',
    year: '1163',
  }),
  'Americas': (name) => ({
    story: `In 600 AD, an astronomer named ${name} aligned the great pyramid of Chichén Itzá so precisely that every equinox, the setting sun casts a shadow of a serpent descending the northern staircase. ${name} calculated this alignment using only observation and memory passed down through generations. Twice a year, tourists gather to watch the serpent descend — never knowing they are witnessing ${name}'s final calculation made fifteen centuries ago.`,
    monument: 'Chichén Itzá',
    year: '600 AD',
  }),
  'Middle East & Central Asia': (name) => ({
    story: `In 515 BC, a stonecutter named ${name} carved winged bulls into the gates of Persepolis. They worked alongside artisans from twenty-three nations — each bringing their own craft to Darius the Great's ceremonial capital. ${name}'s bulls guarded the Gate of All Nations, where ambassadors from across the known world entered bearing tribute. The ruins still echo with the footsteps of those who passed beneath ${name}'s watchful guardians.`,
    monument: 'Persepolis',
    year: '515 BC',
  }),
  'Southeast Asia': (name) => ({
    story: `In the 9th century, a sculptor named ${name} carved apsara dancers into the sandstone walls of Angkor Wat. Working through monsoon seasons, they depicted celestial beings with such grace that the stone seems to breathe. Over two thousand unique apsaras adorn the temple — and ${name}'s are among the most celebrated, recognizable by the distinctive curve of their headdresses. The jungle has tried to reclaim the temple many times, but ${name}'s dancers still emerge from the stone.`,
    monument: 'Angkor Wat',
    year: '9th Century',
  }),
};

export function getFallbackStory(
  region: string,
  firstName: string,
): {story: string; monument: string; year: string} {
  const generator = FALLBACK_STORIES[region] ?? FALLBACK_STORIES['South Asia'];
  return generator(firstName);
}
