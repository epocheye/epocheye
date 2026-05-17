/**
 * Fetches the user's personalized "On this day" payload for the Daily tab.
 * Server caches per (user, date) for 24h so refetching is cheap.
 */

import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {getDailyToday, type DailyToday} from '../../utils/api/daily';

export interface UseDailyTodayReturn {
  daily: DailyToday | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDailyToday(): UseDailyTodayReturn {
  const [daily, setDaily] = useState<DailyToday | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDailyToday();
      if (result.success) {
        setDaily(result.data);
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

  return {daily, loading, refresh};
}
