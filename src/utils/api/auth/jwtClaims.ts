/**
 * Lightweight JWT payload decoder. We use the access token's `is_admin`
 * claim to gate admin-only mobile UI (anchor capture, etc.); the backend
 * re-checks the same claim on every privileged endpoint, so a tampered
 * client only loses the UI, not authorisation.
 *
 * No signature verification here — the token was already validated by the
 * server when it was minted, and any modification would be caught by the
 * server on the next API call.
 */

interface AccessTokenClaims {
  user_uuid?: string;
  email?: string;
  exp?: number;
  type?: string;
  is_admin?: boolean;
}

// Hermes (RN's default JS engine) exposes atob globally; declare for TS.
declare const atob: (input: string) => string;

function base64UrlToString(input: string): string {
  // JWT segments are base64url, not base64. Convert before decoding.
  let padded = input.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) padded += '=';
  return atob(padded);
}

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const segments = token.split('.');
    if (segments.length !== 3) return null;
    const decoded = base64UrlToString(segments[1]);
    return JSON.parse(decoded) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function isAdminFromToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const claims = decodeAccessToken(token);
  return claims?.is_admin === true;
}
