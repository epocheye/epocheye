/**
 * Tracks the current user's Explorer Pass status.
 * Re-fetches on screen focus so the UI reacts after a fresh purchase.
 */

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  getMyExplorerPasses,
  checkPlaceAccess,
  type ExplorerPass,
  type CheckAccessResult,
} from '../../utils/api/explorer-pass';

export interface UseExplorerPassReturn {
  passes: ExplorerPass[];
  loading: boolean;
  hasAnyActivePass: boolean;
  refresh: () => Promise<void>;
  checkAccess: (placeId: string) => Promise<CheckAccessResult | null>;
}

export function useExplorerPass(): UseExplorerPassReturn {
  const [passes, setPasses] = useState<ExplorerPass[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyExplorerPasses();
      if (result.success) {
        setPasses(result.data.passes ?? []);
      } else {
        setPasses([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const checkAccess = useCallback(
    async (placeId: string): Promise<CheckAccessResult | null> => {
      const result = await checkPlaceAccess(placeId);
      if (result.success) {
        return result.data;
      }
      return null;
    },
    [],
  );

  const hasAnyActivePass = passes.some(p => p.is_active);

  return {
    passes,
    loading,
    hasAnyActivePass,
    refresh,
    checkAccess,
  };
}
