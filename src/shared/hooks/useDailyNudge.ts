/**
 * Manages the daily nudge toggle on the Daily tab.
 * On mount, reads the current state. `toggle` posts the new state and
 * optimistically updates local UI.
 */

import {useCallback, useEffect, useState} from 'react';
import {
  getDailyNudge,
  setDailyNudge,
  type DailyNudgeState,
} from '../../utils/api/daily';

const DEFAULT_STATE: DailyNudgeState = {enabled: false, time_local: '09:00'};

export interface UseDailyNudgeReturn {
  state: DailyNudgeState;
  loading: boolean;
  toggle: (enabled: boolean) => Promise<void>;
  setTime: (timeLocal: string) => Promise<void>;
}

export function useDailyNudge(): UseDailyNudgeReturn {
  const [state, setState] = useState<DailyNudgeState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await getDailyNudge();
      if (active && result.success) {
        setState(result.data);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback(
    async (enabled: boolean) => {
      const next: DailyNudgeState = {...state, enabled};
      setState(next); // optimistic
      const result = await setDailyNudge(next);
      if (result.success) {
        setState(result.data);
      } else {
        setState(state); // revert on failure
      }
    },
    [state],
  );

  const setTime = useCallback(
    async (timeLocal: string) => {
      const next: DailyNudgeState = {...state, time_local: timeLocal};
      setState(next);
      const result = await setDailyNudge(next);
      if (result.success) {
        setState(result.data);
      } else {
        setState(state);
      }
    },
    [state],
  );

  return {state, loading, toggle, setTime};
}
