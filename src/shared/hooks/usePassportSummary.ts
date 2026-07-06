/**
 * Fetches the Passport summary on mount + on focus.
 *
 * Primary source: GET /api/v1/passport/summary — server-authoritative
 * (apis/passport: XP ledger, level, badges, streak; reconciled from visits).
 * Only when that call fails (offline / backend down) does the hook fall back
 * to deriving sites + streak client-side from /api/v1/visits/history +
 * getMyExplorerPasses. The fallback has no dynasty/XP/badge data — those
 * fields are omitted and the UI derives display equivalents.
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
    // dynasties_count omitted: visit history carries no dynasty data, so the
    // fallback genuinely doesn't know it (the server path always sends it).
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
