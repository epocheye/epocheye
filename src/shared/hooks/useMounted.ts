/**
 * useMounted Hook
 * Track component mounted state to prevent state updates after unmount
 */

import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook that returns a function to check if component is still mounted
 * Useful for preventing state updates in async callbacks after unmount
 *
 * @example
 * const isMounted = useMounted();
 *
 * const fetchData = async () => {
 *   const data = await api.getData();
 *   if (isMounted()) {
 *     setData(data); // Only update if still mounted
 *   }
 * };
 */
export function useMounted(): () => boolean {
  const mounted = useRef<boolean>(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return useCallback(() => mounted.current, []);
}
