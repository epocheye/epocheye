/**
 * Client-derived gamification model for the premium redesign.
 *
 * XP, levels and badges are pure functions of counters the app already holds
 * (sites visited, streak days, dynasties) — no backend dependency. This mirrors
 * the derivation style of `./passport.ts` so the gamified UI can ship now and
 * swap to server-authoritative values later without touching the screens.
 *
 * Rank thresholds are kept identical to `LevelBadge.rankForSites` so the two
 * stay consistent; progress within a rank is expressed as XP (50 XP per site)
 * to match the Passport / Home premium mockups.
 */

export interface AchievementInput {
  /** Distinct heritage sites visited. */
  sitesVisited: number;
  /** Current daily streak length. */
  streakDays: number;
  /** Distinct dynasties / eras encountered. */
  dynasties: number;
}

export interface Rank {
  level: number;
  title: string;
  /** Minimum sites visited to hold this rank. */
  minSites: number;
}

/** Explorer ranks (matches LevelBadge.rankForSites thresholds). */
export const RANKS: readonly Rank[] = [
  { level: 1, title: 'Wanderer', minSites: 0 },
  { level: 2, title: 'Wayfarer', minSites: 3 },
  { level: 3, title: 'Pathfinder', minSites: 8 },
  { level: 4, title: 'Historian', minSites: 15 },
  { level: 5, title: 'Chronicler', minSites: 25 },
] as const;

const XP_PER_SITE = 50;
const XP_PER_STREAK_DAY = 10;
const XP_PER_DYNASTY = 30;

/** Total lifetime XP — a stable, monotonic score from existing counters. */
export function computeXp(input: AchievementInput): number {
  return (
    Math.max(0, input.sitesVisited) * XP_PER_SITE +
    Math.max(0, input.streakDays) * XP_PER_STREAK_DAY +
    Math.max(0, input.dynasties) * XP_PER_DYNASTY
  );
}

export interface LevelProgress {
  level: number;
  title: string;
  /** Title of the next rank, or null at max rank. */
  nextTitle: string | null;
  /** XP accrued inside the current rank band. */
  xpIntoLevel: number;
  /** Total XP width of the current rank band. */
  xpForLevel: number;
  /** XP remaining to reach the next rank (0 at max). */
  xpToNext: number;
  /** 0–1 fill ratio for the XP bar. */
  ratio: number;
  /** True when the user is at the highest rank. */
  isMax: boolean;
}

/**
 * Resolve rank + intra-rank XP progress from the visited-site count. Progress is
 * linear in sites within the band, expressed in XP for display.
 */
export function levelProgress(sitesVisited: number): LevelProgress {
  const sites = Math.max(0, sitesVisited);

  let idx = 0;
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (sites >= RANKS[i].minSites) {
      idx = i;
      break;
    }
  }

  const current = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;

  if (!next) {
    return {
      level: current.level,
      title: current.title,
      nextTitle: null,
      xpIntoLevel: 0,
      xpForLevel: 0,
      xpToNext: 0,
      ratio: 1,
      isMax: true,
    };
  }

  const sitesInto = sites - current.minSites;
  const sitesForLevel = next.minSites - current.minSites;
  const xpIntoLevel = sitesInto * XP_PER_SITE;
  const xpForLevel = sitesForLevel * XP_PER_SITE;
  const ratio = sitesForLevel > 0 ? Math.min(1, sitesInto / sitesForLevel) : 1;

  return {
    level: current.level,
    title: current.title,
    nextTitle: next.title,
    xpIntoLevel,
    xpForLevel,
    xpToNext: xpForLevel - xpIntoLevel,
    ratio,
    isMax: false,
  };
}

export type BadgeId =
  | 'first-visit'
  | 'streak-7'
  | 'explorer-5'
  | 'dynasties-3'
  | 'historian'
  | 'streak-30';

export interface Badge {
  id: BadgeId;
  title: string;
  /** lucide-react-native icon key; mapped to a component in BadgeGrid. */
  icon: string;
  earned: boolean;
}

/** Derive the achievement set (earned + locked) from the same counters. */
export function deriveBadges(input: AchievementInput): Badge[] {
  const { sitesVisited, streakDays, dynasties } = input;
  return [
    { id: 'first-visit', title: 'First Visit', icon: 'medal', earned: sitesVisited >= 1 },
    { id: 'streak-7', title: '7-Day Streak', icon: 'flame', earned: streakDays >= 7 },
    { id: 'explorer-5', title: 'Explorer', icon: 'compass', earned: sitesVisited >= 5 },
    { id: 'dynasties-3', title: 'Dynast', icon: 'crown', earned: dynasties >= 3 },
    { id: 'historian', title: 'Historian', icon: 'scroll', earned: sitesVisited >= 15 },
    { id: 'streak-30', title: 'Devotee', icon: 'sparkles', earned: streakDays >= 30 },
  ];
}

/** Count of earned badges — handy for the "n of m" header. */
export function earnedCount(badges: Badge[]): number {
  return badges.reduce((n, b) => n + (b.earned ? 1 : 0), 0);
}
