/**
 * Tracks the current user's Epocheye Premium pass status.
 * Re-fetches on screen focus so the UI reacts after a fresh purchase.
 */

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getMyPremiumPass, type PremiumPass } from '../../utils/api/premium';

export interface UsePremiumPassReturn {
  pass: PremiumPass | null;
  loading: boolean;
  hasActivePass: boolean;
  refresh: () => Promise<void>;
}

export function usePremiumPass(): UsePremiumPassReturn {
  const [pass, setPass] = useState<PremiumPass | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyPremiumPass();
      if (result.success) {
        setPass(result.data.pass);
      } else {
        setPass(null);
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

  return {
    pass,
    loading,
    hasActivePass: Boolean(pass?.is_active),
    refresh,
  };
}
