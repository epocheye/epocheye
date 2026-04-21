/**
 * Hook that checks native AR availability on mount.
 *
 * Returns { arAvailable, arChecked } — `arChecked` is false until
 * the native check completes, so the UI can defer rendering the AR
 * toggle until we know for sure. Runs on both Android (ARCore) and
 * iOS (ARKit world tracking).
 */

import { useEffect, useState } from 'react';
import { isARCoreAvailable } from '../../native/ARCoreModule';

export interface UseARCoreReturn {
  arAvailable: boolean;
  arChecked: boolean;
}

export function useARCore(): UseARCoreReturn {
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isARCoreAvailable().then(v => {
      if (cancelled) return;
      setAvailable(v);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { arAvailable: available, arChecked: checked };
}
