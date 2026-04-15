/**
 * User Actions API Types
 * Covers visit logging and visit history endpoints.
 */

export interface LogVisitRequest {
  place_id: string;
}

export interface LogVisitResponse {
  status: string;
}

export interface VisitHistoryResponse {
  visit_history: string[];
}

export interface UserActionsError {
  message: string;
  statusCode: number;
}

export type UserActionsResult<T> =
  | { success: true; data: T }
  | { success: false; error: UserActionsError };
