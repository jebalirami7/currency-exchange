import { isSupported } from '../core/currencies';
import type { RateSnapshot } from '../core/types';

const STORAGE_KEY = 'currency-exchange:last-snapshot';

interface StoredSnapshot {
  base: string;
  rates: Record<string, number>;
  updatedAt: string;
  fetchedAt: string;
  nextUpdateAt?: string;
  provider: string;
}

/**
 * Persists the most recent snapshot so a reload — or a refresh while offline —
 * can show rates immediately instead of an empty screen.
 *
 * Every access is guarded: `localStorage` throws in private windows and when
 * site data is blocked, and the app must work without it.
 */
export function readCachedSnapshot(): RateSnapshot | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as StoredSnapshot;
    const updatedAt = new Date(stored.updatedAt);
    const fetchedAt = new Date(stored.fetchedAt);

    if (
      !isSupported(stored.base) ||
      Number.isNaN(updatedAt.getTime()) ||
      Number.isNaN(fetchedAt.getTime())
    ) {
      return null;
    }

    const nextUpdateAt = stored.nextUpdateAt ? new Date(stored.nextUpdateAt) : undefined;

    return {
      base: stored.base,
      rates: stored.rates,
      updatedAt,
      fetchedAt,
      ...(nextUpdateAt && !Number.isNaN(nextUpdateAt.getTime()) ? { nextUpdateAt } : {}),
      provider: stored.provider,
    };
  } catch {
    return null;
  }
}

export function writeCachedSnapshot(snapshot: RateSnapshot): void {
  try {
    const stored: StoredSnapshot = {
      base: snapshot.base,
      rates: { ...snapshot.rates },
      // `toISOString` throws on a date a provider gave us in a bad format,
      // so serialising belongs inside the guard alongside the storage call.
      updatedAt: snapshot.updatedAt.toISOString(),
      fetchedAt: snapshot.fetchedAt.toISOString(),
      ...(snapshot.nextUpdateAt ? { nextUpdateAt: snapshot.nextUpdateAt.toISOString() } : {}),
      provider: snapshot.provider,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Unusable timestamp, or storage unavailable or full — either way the
    // in-memory snapshot still works.
  }
}
