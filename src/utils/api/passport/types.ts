import type {ExplorerPass} from '../explorer-pass/types';

export interface PassportSummary {
  streak_days: number;
  sites_visited: number;
  sites_goal: number;
  dynasties_count: number;
  active_passes: ExplorerPass[];

  /**
   * Server-authoritative gamification (all optional). When the backend ships
   * these, the UI uses them verbatim; until then the client derives equivalents
   * from the counters above via `src/shared/utils/achievements.ts`.
   */
  /** Total lifetime XP. */
  xp?: number;
  /** Explorer level (1–5). */
  level?: number;
  /** Rank title for the level (e.g. "Historian"). */
  rank_title?: string;
  /** XP accrued within the current rank band (for the XP bar fill). */
  xp_into_level?: number;
  /** Total XP span of the current rank band. */
  xp_for_level?: number;
  /** Earned badge ids matching achievements.ts `BadgeId` values. */
  badges?: string[];
}

export interface PassportStamp {
  place_id: string;
  place_name: string;
  built_year: number | null;
  visited_at: string;
  image_url: string | null;
}

export interface LockedSite {
  place_id: string;
  place_name: string;
  hint: string | null;
}

export interface PassportStampsResponse {
  stamps: PassportStamp[];
  locked_sites: LockedSite[];
}

export type ApiResult<T> =
  | {success: true; data: T}
  | {success: false; error: {message: string; statusCode: number}};
