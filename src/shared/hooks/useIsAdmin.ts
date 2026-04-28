/**
 * Reads the is_admin flag off the current access token. Re-evaluates on
 * every session change so a relogin (after the backend flips is_admin)
 * is picked up immediately without a manual reload.
 *
 * The mobile UI uses this to surface admin-only entry points (anchor
 * capture, etc.). The backend re-checks the same claim on every gated
 * endpoint, so this hook is a UI affordance, not a security boundary.
 */
import { useEffect, useState } from 'react';

import { getAccessToken } from '../../utils/api/auth';
import { isAdminFromToken } from '../../utils/api/auth/jwtClaims';
import { useSessionStore } from '../../stores/sessionStore';

export function useIsAdmin(): boolean {
  const authenticated = useSessionStore(s => s.authenticated);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!authenticated) {
      setIsAdmin(false);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      setIsAdmin(isAdminFromToken(token));
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  return isAdmin;
}
