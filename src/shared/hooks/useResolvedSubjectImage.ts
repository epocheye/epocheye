/**
 * Shared hook for subject-image resolution.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getResolvedSubjectImageFromCache,
  resolveSubjectImage,
  type ResolveSubjectImageParams,
} from '../services/image-resolve.service';

export interface UseResolvedSubjectImageOptions {
  subject?: string | null;
  context?: string;
  enabled?: boolean;
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
  const { subject, context, enabled = true } = options;
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

    if (!enabled || !normalizedSubject) {
      setState(EMPTY_STATE);
      return;
    }

    const cached = getResolvedSubjectImageFromCache(params);
    if (cached) {
      setState({
        url: cached.url,
        loading: false,
        error: cached.error,
        source: cached.source,
        fromMemoryCache: cached.fromMemoryCache,
      });
      return;
    }

    setState(previous => ({
      ...previous,
      loading: true,
      error: null,
    }));

    const resolved = await resolveSubjectImage(params);

    if (requestIdRef.current !== requestId) {
      return;
    }

    setState({
      url: resolved.url,
      loading: false,
      error: resolved.error,
      source: resolved.source,
      fromMemoryCache: resolved.fromMemoryCache,
    });
  }, [enabled, normalizedSubject, params]);

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
