import { beforeEach, describe, expect, it } from 'vitest';
import type { RateSnapshot } from '../../core/types';
import { readCachedSnapshot, writeCachedSnapshot } from '../cache';

const snapshot: RateSnapshot = {
  base: 'USD',
  rates: { USD: 1, IDR: 16_238.5, TND: 2.9117 },
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  fetchedAt: new Date('2026-01-01T03:00:00Z'),
  nextUpdateAt: new Date('2026-01-02T00:00:00Z'),
  provider: 'test',
};

describe('snapshot cache', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a snapshot', () => {
    writeCachedSnapshot(snapshot);
    expect(readCachedSnapshot()).toEqual(snapshot);
  });

  it('round-trips a snapshot without a next-update time', () => {
    const { nextUpdateAt: _, ...withoutNext } = snapshot;
    writeCachedSnapshot(withoutNext);

    const read = readCachedSnapshot();
    expect(read).toEqual(withoutNext);
    expect(read).not.toHaveProperty('nextUpdateAt');
  });

  it('returns null when nothing is cached', () => {
    expect(readCachedSnapshot()).toBeNull();
  });

  it('discards a corrupt or unusable entry rather than throwing', () => {
    localStorage.setItem('currency-exchange:last-snapshot', '{not json');
    expect(readCachedSnapshot()).toBeNull();

    writeCachedSnapshot({ ...snapshot, updatedAt: new Date('nope') });
    expect(readCachedSnapshot()).toBeNull();
  });
});
