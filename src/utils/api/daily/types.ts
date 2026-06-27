export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface DailyStreakDay {
  weekday: Weekday;
  date_num: number;
  visited: boolean;
  is_today: boolean;
}

export interface DailyToday {
  date: string;
  year: number;
  location: string;
  body: string;
  /** Wikipedia page thumbnail for the day's event, when available. */
  image_url?: string;
  cta_place_id: string | null;
  cta_label: string | null;
  /** External article URL — set when there's no Epocheye site to link to. */
  cta_url?: string | null;
  streak_count: number;
  weekly_streak: DailyStreakDay[];
}

export type ApiResult<T> =
  | {success: true; data: T}
  | {success: false; error: {message: string; statusCode: number}};
