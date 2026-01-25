/**
 * useAsync Hook
 * Handle async operations with loading and error states
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * State returned by useAsync hook
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Full return type of useAsync hook
 */
export interface UseAsyncReturn<T> extends AsyncState<T> {
  /** Execute the async function */
  execute: () => Promise<void>;
  /** Reset state to initial values */
  reset: () => void;
  /** Whether the operation has been executed at least once */
  hasExecuted: boolean;
}

/**
 * Hook for managing async operations with loading and error states
 *
 * @param asyncFunction - The async function to execute
 * @param immediate - Whether to execute immediately on mount (default: false)
 * @param deps - Dependencies to trigger re-execution (only when immediate is true)
 *
 * @example
 * const { data, isLoading, error, execute } = useAsync(
 *   () => fetchUserProfile(),
 *   true // Execute immediately
 * );
 *
 * @example
 * const { data, isLoading, error, execute } = useAsync(
 *   () => saveProfile(formData),
 *   false // Don't execute immediately
 * );
 * // Later: await execute();
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = false,
  deps: React.DependencyList = []
): UseAsyncReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: immediate,
    error: null,
  });

  const [hasExecuted, setHasExecuted] = useState<boolean>(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef<boolean>(true);

  // Store the async function in a ref to avoid stale closures
  const asyncFunctionRef = useRef(asyncFunction);
  asyncFunctionRef.current = asyncFunction;

  /**
   * Execute the async function
   */
  const execute = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const result = await asyncFunctionRef.current();

      if (isMounted.current) {
        setState({
          data: result,
          isLoading: false,
          error: null,
        });
        setHasExecuted(true);
      }
    } catch (error) {
      if (isMounted.current) {
        setState({
          data: null,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        setHasExecuted(true);
      }
    }
  }, []);

  /**
   * Reset state to initial values
   */
  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    });
    setHasExecuted(false);
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    ...state,
    execute,
    reset,
    hasExecuted,
  };
}
