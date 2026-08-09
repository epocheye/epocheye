// ADMIN-HARNESS (REMOVE AFTER KONARK)
/**
 * Runtime admin-email allowlist for the internal AR harness (Cloud Anchor
 * host/resolve, Check Konark VPS, depth-occlusion toggle). Ships in release but
 * gates every internal tool so only these accounts see it — regular users get
 * the production path unchanged.
 *
 * Reads the existing authenticated profile from `useUserStore`; introduces no
 * new auth system. `useUserStore.getState()` is a synchronous store read (not a
 * hook), so `isAdminUser()` is callable from anywhere. Components should pass a
 * reactively-subscribed email (`useUserStore(s => s.profile?.email)`) so they
 * re-render once the profile finishes loading after login.
 */
import {useUserStore} from '../../stores/userStore';

/**
 * Keep this in step with `users.is_admin` in the database. They are two
 * separate gates and both must pass: this list decides whether the on-site
 * tooling is VISIBLE, and the `is_admin` claim on the JWT is what the API
 * actually trusts (`middleware.IsAdminFromContext`). Migration 082 sets the
 * flag for exactly these accounts.
 *
 * `is_admin` is read when a token is MINTED, so an account promoted after
 * sign-in must sign out and back in before the API will honour it.
 */
export const ADMIN_EMAILS = [
  'thewhitedevil32@gmail.com',
  'sambit@epocheye.app',
  // Platform owner — named in migration 032's own instructions as the account
  // to promote, so the DB flag is almost certainly already set; this list was
  // simply out of step with it.
  'likhit.nayak@silicon.ac.in',
];

const NORMALIZED_ADMIN_EMAILS = ADMIN_EMAILS.map(e => e.trim().toLowerCase());

/**
 * True only when the logged-in email is in {@link ADMIN_EMAILS}
 * (case-insensitive, trimmed). Pass an email to compare a specific value;
 * omit it to read the current profile synchronously.
 */
export function isAdminUser(email?: string | null): boolean {
  const candidate = (email ?? useUserStore.getState().profile?.email)
    ?.trim()
    .toLowerCase();
  return !!candidate && NORMALIZED_ADMIN_EMAILS.includes(candidate);
}
