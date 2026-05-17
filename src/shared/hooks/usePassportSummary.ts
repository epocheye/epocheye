/**
 * Fetches the Passport summary on mount + on focus.
 *
 * Primary source: GET /api/v1/passport/summary (not yet implemented on the
 * Go backend). When that fails, the hook falls back to deriving the summary
 * client-side from /api/v1/visits/history + getMyExplorerPasses, so the UI
 * renders real data today.
 */

import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  getPassportSummary,
  type PassportSummary,
} from '../../utils/api/passport';
import {getVisitHistory} from '../../utils/api/visits';
import {getMyExplorerPasses} from '../../utils/api/explorer-pass';
import {
  deriveSitesVisited,
  deriveStreakDays,
} from '../utils/passport';

const DEFAULT_SITES_GOAL = 50;

export interface UsePassportSummaryReturn {
  summary: PassportSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

async function fetchDerivedSummary(): Promise<PassportSummary | null> {
  const [historyResult, passesResult] = await Promise.all([
    getVisitHistory(),
    getMyExplorerPasses(),
  ]);

  if (!historyResult.success) return null;
  const visits = historyResult.data.visits ?? [];
  const activePasses = passesResult.success
    ? (passesResult.data.passes ?? []).filter(p => p.is_active)
    : [];

  return {
    streak_days: deriveStreakDays(visits),
    sites_visited: deriveSitesVisited(visits),
    sites_goal: DEFAULT_SITES_GOAL,
    dynasties_count: 0,
    active_passes: activePasses,
  };
}

export function usePassportSummary(): UsePassportSummaryReturn {
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPassportSummary();
      if (result.success && result.data) {
        setSummary(result.data);
        return;
      }
      const derived = await fetchDerivedSummary();
      if (derived) setSummary(derived);
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

  return {summary, loading, refresh};
}
