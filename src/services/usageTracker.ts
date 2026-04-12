/**
 * Tracks daily Gemini API call usage for free-tier rate limiting.
 *
 * Stores a simple { date, count } object in AsyncStorage. The date
 * is YYYY-MM-DD in the device's local timezone. When the date rolls
 * over, the counter resets automatically.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../core/constants/storage-keys';

const FREE_TIER_DAILY_LIMIT = 5;

interface DailyUsage {
  date: string;
  count: number;
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function readUsage(): Promise<DailyUsage> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LENS.GEMINI_DAILY_USAGE);
    if (raw) {
      const parsed: DailyUsage = JSON.parse(raw);
      if (parsed.date === todayKey()) {
        return parsed;
      }
    }
  } catch {
    // Corrupt data — treat as fresh day
  }
  return { date: todayKey(), count: 0 };
}

async function writeUsage(usage: DailyUsage): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.LENS.GEMINI_DAILY_USAGE,
      JSON.stringify(usage),
    );
  } catch {
    // Silent — worst case the counter resets next read
  }
}

/**
 * Returns how many Gemini calls have been made today.
 */
export async function getUsageToday(): Promise<number> {
  const usage = await readUsage();
  return usage.count;
}

/**
 * Returns how many free calls remain. Returns `Infinity` for premium users.
 */
export async function getRemainingCalls(isPremium: boolean): Promise<number> {
  if (isPremium) {
    return Infinity;
  }
  const usage = await readUsage();
  return Math.max(0, FREE_TIER_DAILY_LIMIT - usage.count);
}

/**
 * Checks whether a Gemini call is allowed and, if so, increments the
 * counter. Returns `true` if the call is allowed, `false` if the daily
 * limit has been reached.
 *
 * Premium users always return `true` without touching the counter.
 */
export async function checkAndIncrement(
  isPremium: boolean,
): Promise<boolean> {
  if (isPremium) {
    return true;
  }
  const usage = await readUsage();
  if (usage.count >= FREE_TIER_DAILY_LIMIT) {
    return false;
  }
  usage.count += 1;
  await writeUsage(usage);
  return true;
}

export { FREE_TIER_DAILY_LIMIT };
