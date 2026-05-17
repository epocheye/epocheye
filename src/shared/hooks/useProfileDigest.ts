/**
 * Fetches the user's weekly digest for the Profile tab.
 * Server caches per (user, week_start) for 7 days.
 */

import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {getProfileDigest, type ProfileDigest} from '../../utils/api/profile';

export interface UseProfileDigestReturn {
  digest: ProfileDigest | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useProfileDigest(): UseProfileDigestReturn {
  const [digest, setDigest] = useState<ProfileDigest | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProfileDigest();
      if (result.success) {
        setDigest(result.data);
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

  return {digest, loading, refresh};
}
