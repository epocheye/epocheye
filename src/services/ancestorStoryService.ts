/**
 * SSE service for AI-generated ancestor stories.
 * Uses XMLHttpRequest for streaming in React Native (fetch doesn't support ReadableStream).
 * Called from OB07_Promise on mount.
 */

import {BACKEND_URL} from '../constants/onboarding';
import {getFallbackStory} from './fallbackStories';
import {createSSEStream} from './sseStreamService';

interface StreamParams {
  firstName: string;
  regions: string[];
  motivation: string;
  visitFrequency: string;
  goal: string;
  onChunk: (text: string) => void;
  onDone: (monument: string) => void;
  onError: () => void;
}

export function streamAncestorStory({
  firstName,
  regions,
  motivation,
  visitFrequency,
  goal,
  onChunk,
  onDone,
  onError,
}: StreamParams): () => void {
  const safeFirstName = firstName.trim().length > 0 ? firstName : 'Explorer';
  const primaryRegion = regions[0] ?? 'South Asia';
  const fallbackMonument = getFallbackStory(primaryRegion, safeFirstName).monument;

  let hasErrored = false;
  let hasDone = false;
  let activeAbort: (() => void) | null = null;

  const safeOnError = () => {
    if (hasErrored || hasDone) {
      return;
    }
    hasErrored = true;
    onError();
  };

  const safeOnDone = (monument: string) => {
    if (hasErrored || hasDone) {
      return;
    }

    hasDone = true;
    onDone(monument);
  };

  const handleChunk = (text: string) => {
    if (hasErrored || hasDone || text.length === 0) {
      return;
    }

    onChunk(text);
  };

  const handleBackendFailure = () => {
    if (hasErrored || hasDone) {
      return;
    }

    safeOnError();
  };

  const handleBackendMessage = (payload: Record<string, unknown>) => {
    const message = payload as {
      type?: string;
      text?: string;
      monument?: string;
    };

    if (message.type === 'chunk' && typeof message.text === 'string') {
      handleChunk(message.text);
      return;
    }

    if (message.type === 'done') {
      const monument =
        typeof message.monument === 'string' && message.monument.length > 0
          ? message.monument
          : fallbackMonument;
      safeOnDone(monument);
      return;
    }

    if (message.type === 'error') {
      handleBackendFailure();
    }
  };

  activeAbort = createSSEStream({
    url: `${BACKEND_URL}/api/onboarding/ancestor-story`,
    body: {firstName, regions, motivation, visitFrequency, goal},
    timeout: 30000,
    onMessage: handleBackendMessage,
    onError: handleBackendFailure,
  });

  return () => {
    activeAbort?.();
  };
}
