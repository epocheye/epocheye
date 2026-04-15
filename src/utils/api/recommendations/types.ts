export interface Recommendation {
  monument_id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  score: number;
  reason: string;
  created_at: string;
}

export interface RecommendationsResponse {
  items: Recommendation[];
  count: number;
  personalized: boolean;
}

export type RecommendationsResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };
