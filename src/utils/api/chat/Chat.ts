/**
 * Chat API module — wraps /api/v1/chat/* endpoints for the Plan tab.
 */

import { createAuthenticatedClient } from '../auth';
import { createErrorResult } from '../helpers';
import type {
  ChatMessage,
  ChatResult,
  ChatSession,
  SendMessageResponse,
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

export async function sendMessage(
  sessionId: string,
  content: string,
): Promise<ChatResult<SendMessageResponse>> {
  try {
    const client = createAuthenticatedClient();
    const resp = await client.post<SendMessageResponse>(
      `/api/v1/chat/sessions/${sessionId}/messages`,
      { content },
    );
    return { success: true, data: resp.data };
  } catch (error) {
    return createErrorResult(error);
  }
}
