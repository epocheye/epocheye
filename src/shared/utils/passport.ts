/**
 * Pure helpers that derive Passport-screen data (streak, sites visited, stamps)
 * from the existing /api/v1/visits/history payload, used as a fallback until
 * the dedicated /api/v1/passport/* endpoints ship.
 *
 * All functions are deterministic and tz-aware: dates are bucketed by the
 * user's local YYYY-MM-DD so a visit at 11pm and the next morning's 1am count
 * as two separate calendar days.
 */

import type {VisitRow} from '../../utils/api/visits';
import type {PassportStamp} from '../../utils/api/passport';

function localDateKey(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Count of distinct place_id values across the user's visits. */
export function deriveSitesVisited(visits: VisitRow[]): number {
  const ids = new Set<string>();
  for (const v of visits) {
    if (v.place_id) ids.add(v.place_id);
  }
  return ids.size;
}

/**
 * Streak = consecutive local-calendar days ending today (or yesterday, if no
 * visit yet today) that each contain at least one visit. Returns 0 if neither
 * today nor yesterday has a visit.
 */
export function deriveStreakDays(visits: VisitRow[], now: Date = new Date()): number {
  if (visits.length === 0) return 0;

  const dayKeys = new Set<string>();
  for (const v of visits) {
    const k = localDateKey(v.arrived_at);
    if (k) dayKeys.add(k);
  }
  if (dayKeys.size === 0) return 0;

  const today = startOfLocalDay(now);
  const todayKey = localDateKey(today.toISOString());

  // If today has no visit, allow the streak to start at yesterday.
  let cursor = new Date(today);
  if (todayKey && !dayKeys.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (;;) {
    const k = localDateKey(cursor.toISOString());
    if (!k || !dayKeys.has(k)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Build stamp rows from visits, one per distinct place_id, taking the earliest
 * arrived_at as `visited_at`. `built_year` and `image_url` stay null until the
 * backend ships them; the Passport UI handles both being null gracefully
 * (colored placeholder + omitted year line).
 */
export function deriveStamps(visits: VisitRow[]): PassportStamp[] {
  const earliest = new Map<string, VisitRow>();
  for (const v of visits) {
    if (!v.place_id) continue;
    const prior = earliest.get(v.place_id);
    if (!prior) {
      earliest.set(v.place_id, v);
      continue;
    }
    if (Date.parse(v.arrived_at) < Date.parse(prior.arrived_at)) {
      earliest.set(v.place_id, v);
    }
  }

  return Array.from(earliest.values()).map(v => ({
    place_id: v.place_id,
    place_name: v.place_name,
    built_year: null,
    visited_at: v.arrived_at,
    image_url: null,
  }));
}
