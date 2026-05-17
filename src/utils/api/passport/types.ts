import type {ExplorerPass} from '../explorer-pass/types';

export interface PassportSummary {
  streak_days: number;
  sites_visited: number;
  sites_goal: number;
  dynasties_count: number;
  active_passes: ExplorerPass[];
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
