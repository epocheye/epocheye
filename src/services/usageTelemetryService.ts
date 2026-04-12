/**
 * Server-side usage telemetry for Gemini calls, HD scans, and story streams.
 *
 * Fire-and-forget: never blocks the UI, never throws.
 * Supplements (does not replace) the client-side daily counter
 * in usageTracker.ts — the server record is for analytics and
 * future server-side rate limiting.
 */

import { createAuthenticatedClient } from '../utils/api/auth';

export type UsageEventType = 'gemini_identify' | 'hd_scan' | 'story_stream';

export function trackUsageEvent(
  eventType: UsageEventType,
  zoneId?: string,
): void {
  // Fire-and-forget — never block the UI
  void createAuthenticatedClient()
    .post('/api/v1/usage/track', {
      event_type: eventType,
      zone_id: zoneId ?? null,
    })
    .catch(() => {
      // Silent — telemetry is best-effort
    });
}
