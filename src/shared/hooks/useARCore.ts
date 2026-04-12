/**
 * Hook that checks ARCore availability on mount.
 *
 * Returns { arAvailable, arChecked } — `arChecked` is false until
 * the native check completes, so the UI can defer rendering the AR
 * toggle until we know for sure.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isARCoreAvailable } from '../../native/ARCoreModule';

export interface UseARCoreReturn {
  arAvailable: boolean;
  arChecked: boolean;
}

export function useARCore(): UseARCoreReturn {
  const [available, setAvailable] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setChecked(true);
      return;
    }
    void isARCoreAvailable().then(v => {
      setAvailable(v);
      setChecked(true);
    });
  }, []);

  return { arAvailable: available, arChecked: checked };
}
