export interface PingRequest {
  lat: number;
  lng: number;
  timestamp?: string;
}

export interface PingResponse {
  matched: boolean;
  active: boolean;
  place_id?: string;
  place_name?: string;
  visit_id?: string;
  pass_id?: string;
  tour_id?: string;
}

export interface VisitRow {
  id: string;
  place_id: string;
  place_name: string;
  lat: number;
  lng: number;
  arrived_at: string;
  left_at?: string | null;
  pass_id?: string | null;
  pass_active: boolean;
  tour_id?: string | null;
  tour_expires_at?: string | null;
}

export interface TourRow {
  id: string;
  place_ids: string[];
  place_names: string[];
  pass_id: string;
  total_paise: number;
  purchased_at: string;
  expires_at: string;
  active: boolean;
}

export interface HistoryResponse {
  visits: VisitRow[];
  tours: TourRow[];
}

export interface CurrentVisit {
  active: boolean;
  visit_id?: string;
  place_id?: string;
  place_name?: string;
  arrived_at?: string | null;
  pass_expires_at?: string | null;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; statusCode: number } };
