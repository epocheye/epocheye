/**
 * Client for the backend Gemini forwarder (`POST /api/v1/vision/gemini`).
 *
 * Why: GEMINI_API_KEY must never ship inside the app (it was previously in the
 * bundled .env and extractable from any release APK). Instead of calling
 * generativelanguage.googleapis.com directly, services post their
 * `generateContent` request body here; the backend injects the key and relays
 * Gemini's response verbatim. Callers build the same request body and parse the
 * same response shape as before — only the transport changes.
 */

import axios from 'axios';
import { BACKEND_URL } from '../constants/onboarding';
import { getValidAccessToken } from '../utils/api/auth';

const PROXY_URL = `${BACKEND_URL}/api/v1/vision/gemini`;

export type GeminiMethod = 'generateContent';

/**
 * Forward a Gemini request through the backend. Resolves with the upstream
 * Gemini response JSON verbatim (identical shape to a direct call), or throws
 * an AxiosError on transport/HTTP failure — so existing
 * `axios.isAxiosError(...)` / status / `ECONNABORTED` handling keeps working.
 */
export async function callGeminiProxy(
  model: string,
  method: GeminiMethod,
  body: unknown,
  timeoutMs: number,
): Promise<any> {
  const token = await getValidAccessToken();
  const response = await axios.post(
    PROXY_URL,
    { model, method, body },
    {
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  return response.data;
}
