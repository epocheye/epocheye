/**
 * Shared hook for subject-image resolution.
 *
 * Resolution order:
 *   1. In-memory Gemini cache hit → instant
 *   2. AsyncStorage-persisted Gemini hit → instant
 *   3. Fresh Gemini image generation call
 *   4. Backend /api/v1/images/resolve fallback (legacy path)
 *
 * The Gemini path is primary because the backend resolver has been
 * unreliable. Backend call remains as a last-resort fallback so we
 * degrade gracefully when Gemini quota is exhausted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getResolvedSubjectImageFromCache,
  resolveSubjectImage,
  type ResolveSubjectImageParams,
} from '../services/image-resolve.service';
import {
  generateMonumentImage,
  peekMonumentImageFromMemory,
} from '../../services/geminiImageService';

export interface UseResolvedSubjectImageOptions {
  subject?: string | null;
  context?: string;
  enabled?: boolean;
  remote?: boolean;
}

export interface UseResolvedSubjectImageResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  source: string | null;
  fromMemoryCache: boolean;
  refresh: () => Promise<void>;
}

interface ImageState {
  url: string | null;
  loading: boolean;
  error: string | null;
  source: string | null;
  fromMemoryCache: boolean;
}

const EMPTY_STATE: ImageState = {
  url: null,
  loading: false,
  error: null,
  source: null,
  fromMemoryCache: false,
};

export function useResolvedSubjectImage(
  options: UseResolvedSubjectImageOptions,
): UseResolvedSubjectImageResult {
  const { subject, context, enabled = true, remote = false } = options;
  const normalizedSubject = useMemo(() => subject?.trim() ?? '', [subject]);
  const normalizedContext = useMemo(() => context?.trim(), [context]);

  const params = useMemo<ResolveSubjectImageParams>(
    () => ({
      subject: normalizedSubject,
      ...(normalizedContext ? { context: normalizedContext } : {}),
    }),
    [normalizedContext, normalizedSubject],
  );

  const requestIdRef = useRef(0);

  const [state, setState] = useState<ImageState>(EMPTY_STATE);

  const runResolution = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!enabled || !remote || !normalizedSubject) {
      setState(EMPTY_STATE);
      return;
    }

    // 1. Gemini in-memory cache (synchronous)
    const geminiMemory = peekMonumentImageFromMemory({
      subject: normalizedSubject,
      context: normalizedContext,
    });
    if (geminiMemory) {
      setState({
        url: geminiMemory.url,
        loading: false,
        error: null,
        source: 'gemini:memory',
        fromMemoryCache: true,
      });
      return;
    }

    // 2. Legacy backend cache (kept for back-compat during transition)
    const legacyCached = getResolvedSubjectImageFromCache(params);
    if (legacyCached && legacyCached.url) {
      setState({
        url: legacyCached.url,
        loading: false,
        error: legacyCached.error,
        source: legacyCached.source,
        fromMemoryCache: legacyCached.fromMemoryCache,
      });
      return;
    }

    setState(previous => ({
      ...previous,
      loading: true,
      error: null,
    }));

    // 3. Try Gemini (will hit AsyncStorage or call API)
    const generated = await generateMonumentImage({
      subject: normalizedSubject,
      context: normalizedContext,
    });

    if (requestIdRef.current !== requestId) return;

    if (generated) {
      setState({
        url: generated.url,
        loading: false,
        error: null,
        source: generated.fromCache ? 'gemini:persisted' : 'gemini:generated',
        fromMemoryCache: generated.fromCache,
      });
      return;
    }

    // 4. Last-resort: backend resolver
    const resolved = await resolveSubjectImage(params);

    if (requestIdRef.current !== requestId) return;

    setState({
      url: resolved.url,
      loading: false,
      error: resolved.error,
      source: resolved.source,
      fromMemoryCache: resolved.fromMemoryCache,
    });
  }, [enabled, normalizedContext, normalizedSubject, params, remote]);

  useEffect(() => {
    runResolution().catch(() => {
      setState({
        url: null,
        loading: false,
        error: 'Unable to resolve image right now.',
        source: null,
        fromMemoryCache: false,
      });
    });
  }, [runResolution]);

  return {
    url: state.url,
    loading: state.loading,
    error: state.error,
    source: state.source,
    fromMemoryCache: state.fromMemoryCache,
    refresh: runResolution,
  };
}
