/**
 * Chat API module — wraps /api/v1/chat/* endpoints for the Plan tab.
 */

import { BACKEND_URL } from '../../../constants/onboarding';
import { createSSEStream } from '../../../services/sseStreamService';
import { createAuthenticatedClient, getValidAccessToken } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ChatMessage,
  ChatResult,
  ChatSession,
} from './types';

export async function listSessions(): Promise<ChatResult<ChatSession[]>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<ChatSession[]>('/api/v1/chat/sessions');
    return { success: true, data: resp.data ?? [] };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function createSession(
  title?: string,
): Promise<ChatResult<ChatSession>> {
  try {
    const client = createAuthenticatedClient();
    const body = title?.trim() ? { title: title.trim() } : undefined;
    const resp = await client.post<ChatSession>('/api/v1/chat/sessions', body);
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function deleteSession(
  sessionId: string,
): Promise<ChatResult<{ deleted: boolean }>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.delete<{ deleted: boolean }>(
      `/api/v1/chat/sessions/${sessionId}`,
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}

export async function listMessages(
  sessionId: string,
): Promise<ChatResult<ChatMessage[]>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.get<ChatMessage[]>(
      `/api/v1/chat/sessions/${sessionId}/messages`,
    );
    return { success: true, data: resp.data ?? [] };
  } catch (error) {
    return createErrorResult(error);
  }
}

export interface StreamMessageCallbacks {
  onUserMessage: (message: ChatMessage) => void;
  onChunk: (text: string) => void;
  onDone: (result: {
    assistantMessage: ChatMessage;
    sources: string[];
    grounded: boolean;
    truncated: boolean;
  }) => void;
  onError: (message: string) => void;
}

// Streams an assistant reply via SSE. Returns an abort function.
export async function streamMessage(
  sessionId: string,
  content: string,
  callbacks: StreamMessageCallbacks,
): Promise<() => void> {
  const token = await getValidAccessToken();
  if (!token) {
    callbacks.onError('Not authenticated. Please login again.');
    return () => {};
  }

  let settled = false;
  const settleError = (msg: string) => {
    if (settled) return;
    settled = true;
    callbacks.onError(msg);
  };

  const abort = createSSEStream({
    url: `${BACKEND_URL}/api/v1/chat/sessions/${sessionId}/messages`,
    body: { content },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 45000,
    onMessage: payload => {
      const type = payload.type as string | undefined;
      switch (type) {
        case 'user_message': {
          const message = payload.message as ChatMessage | undefined;
          if (message) callbacks.onUserMessage(message);
          return;
        }
        case 'chunk': {
          const text = payload.text as string | undefined;
          if (typeof text === 'string' && text.length > 0) {
            callbacks.onChunk(text);
          }
          return;
        }
        case 'done': {
          if (settled) return;
          settled = true;
          const assistantMessage = payload.assistant_message as
            | ChatMessage
            | undefined;
          if (!assistantMessage) {
            callbacks.onError('Malformed done frame');
            return;
          }
          const sources = Array.isArray(payload.sources)
            ? (payload.sources as string[])
            : [];
          callbacks.onDone({
            assistantMessage,
            sources,
            grounded: Boolean(payload.grounded),
            truncated: Boolean(payload.truncated),
          });
          return;
        }
        case 'error': {
          const message =
            (payload.message as string | undefined) ?? 'Model error';
          settleError(message);
          return;
        }
      }
    },
    onError: () => settleError('Connection error'),
  });

  return abort;
}
