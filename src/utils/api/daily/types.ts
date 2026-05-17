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
  cta_place_id: string | null;
  cta_label: string | null;
  streak_count: number;
  weekly_streak: DailyStreakDay[];
}

export interface DailyNudgeState {
  enabled: boolean;
  time_local: string;
}

export type ApiResult<T> =
  | {success: true; data: T}
  | {success: false; error: {message: string; statusCode: number}};
