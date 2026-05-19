/**
 * Fetches the user's collected stamps + nearby locked sites for the Passport tab.
 *
 * Primary source: GET /api/v1/passport/stamps (not yet implemented). When that
 * fails, the hook falls back to deriving stamps client-side from
 * /api/v1/visits/history. `lockedSites` stays empty until the backend ships
 * a way to suggest nearby unvisited sites.
 */

import {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  getPassportStamps,
  type LockedSite,
  type PassportStamp,
} from '../../utils/api/passport';
import {getVisitHistory} from '../../utils/api/visits';
import {usePlacesStore} from '../../stores/placesStore';
import {deriveLockedFromSaved, deriveStamps} from '../utils/passport';

export interface UsePassportStampsOptions {
  dynasty?: string;
}

export interface UsePassportStampsReturn {
  stamps: PassportStamp[];
  lockedSites: LockedSite[];
  loading: boolean;
  refresh: () => Promise<void>;
}

async function fetchDerivedStamps(): Promise<{
  stamps: PassportStamp[];
  lockedSites: LockedSite[];
}> {
  const historyResult = await getVisitHistory();
  const visits = historyResult.success
    ? historyResult.data.visits ?? []
    : [];
  // Lazy read of the saved-places store — we just need the current snapshot.
  // Saved.tsx / PlanList separately keep this list fresh via ensureSavedPlacesLoaded.
  const savedPlaces = usePlacesStore.getState().savedPlaces ?? [];
  return {
    stamps: deriveStamps(visits),
    lockedSites: deriveLockedFromSaved(savedPlaces, visits),
  };
}

export function usePassportStamps(
  options?: UsePassportStampsOptions,
): UsePassportStampsReturn {
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [lockedSites, setLockedSites] = useState<LockedSite[]>([]);
  const [loading, setLoading] = useState(true);

  const dynasty = options?.dynasty;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getPassportStamps(
        dynasty ? {dynasty} : undefined,
      );
      if (result.success && result.data) {
        setStamps(result.data.stamps ?? []);
        setLockedSites(result.data.locked_sites ?? []);
        return;
      }
      const derived = await fetchDerivedStamps();
      setStamps(derived.stamps);
      setLockedSites(derived.lockedSites);
    } finally {
      setLoading(false);
    }
  }, [dynasty]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return {stamps, lockedSites, loading, refresh};
}
