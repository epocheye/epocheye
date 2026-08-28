/**
 * Guide API — wraps POST /api/v1/sites/{slug}/guide for the AI Guide screen.
 *
 * Mirrors the auth + SSE pattern from src/utils/api/chat/Chat.ts: fetch a
 * valid access token, attach it as a Bearer header, and stream via
 * createSSEStream. Returns an abort function the caller must invoke on
 * unmount so an in-flight request cancels cleanly.
 */

import {BACKEND_URL} from '../../../constants/onboarding';
import {createSSEStream} from '../../../services/sseStreamService';
import {getNarrationLang} from '../../../stores/museumPrefsStore';
import {getValidAccessToken} from '../auth';
import type {GuideHistoryTurn, GuideStreamResult} from './types';

const MAX_HISTORY_TURNS = 6;

export interface StreamGuideCallbacks {
  onChunk: (text: string) => void;
  onDone: (result: GuideStreamResult) => void;
  onError: (message: string) => void;
}

export async function streamGuideAnswer(
  slug: string,
  question: string,
  history: GuideHistoryTurn[],
  callbacks: StreamGuideCallbacks,
): Promise<() => void> {
  const token = await getValidAccessToken();
  if (!token) {
    callbacks.onError('Not authenticated. Please login again.');
    return () => {};
  }

  // Cap history client-side too so we never blow past what the backend trims.
  const trimmed = history.slice(-MAX_HISTORY_TURNS);
  let accumulated = '';
  let settled = false;
  const settleError = (msg: string) => {
    if (settled) return;
    settled = true;
    callbacks.onError(msg);
  };

  const abort = createSSEStream({
    url: `${BACKEND_URL}/api/v1/sites/${encodeURIComponent(slug)}/guide`,
    body: {
      question,
      conversation_history: trimmed,
      // Answer in the user's chosen content language (same source as narration),
      // so the AI guide is localized like the rest of the app.
      lang: getNarrationLang(),
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 45000,
    onMessage: payload => {
      const type = payload.type as string | undefined;
      switch (type) {
        case 'chunk': {
          const text = payload.text as string | undefined;
          if (typeof text === 'string' && text.length > 0) {
            accumulated += text;
            callbacks.onChunk(text);
          }
          return;
        }
        case 'done': {
          if (settled) return;
          settled = true;
          const cached = Boolean(payload.cached);
          const sourceRaw = payload.source as string | undefined;
          const source: 'faq' | 'llm' =
            sourceRaw === 'faq' ? 'faq' : 'llm';
          callbacks.onDone({full: accumulated, cached, source});
          return;
        }
        case 'error': {
          const message =
            (payload.message as string | undefined) ?? 'Guide error';
          settleError(message);
          return;
        }
      }
    },
    onError: () => settleError('Connection error'),
  });

  return abort;
}
