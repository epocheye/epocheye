export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SendMessageResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  sources: string[];
  grounded: boolean;
}

export interface ChatError {
  message: string;
  statusCode: number;
}

export type ChatResult<T> =
  | { success: true; data: T }
  | { success: false; error: ChatError };
