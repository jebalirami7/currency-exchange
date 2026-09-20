import { describe, expect, it } from 'vitest';
import { convert, getRate } from '../convert';
import type { RateSnapshot } from '../types';

const snapshot: RateSnapshot = {
  base: 'USD',
  rates: { USD: 1, IDR: 16_000, TND: 3.2 },
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  fetchedAt: new Date('2026-01-01T00:00:00Z'),
  provider: 'test',
};

describe('getRate', () => {
  it('returns 1 for a currency against itself', () => {
    expect(getRate(snapshot, 'TND', 'TND')).toBe(1);
  });

  it('returns the direct rate when converting from the base', () => {
    expect(getRate(snapshot, 'USD', 'IDR')).toBe(16_000);
  });

  it('derives cross rates that are inverses of each other', () => {
    const forward = getRate(snapshot, 'IDR', 'TND');
    const backward = getRate(snapshot, 'TND', 'IDR');
    expect(forward * backward).toBeCloseTo(1, 10);
  });

  it('throws for a currency the snapshot does not quote', () => {
    expect(() => getRate(snapshot, 'USD', 'JPY')).toThrow(/no rate for JPY/);
  });
});

describe('convert', () => {
  it('scales linearly with the amount', () => {
    expect(convert(2, snapshot, 'USD', 'TND')).toBeCloseTo(6.4, 10);
  });

  it('round-trips through an intermediate currency', () => {
    const toIdr = convert(100, snapshot, 'TND', 'IDR');
    expect(convert(toIdr, snapshot, 'IDR', 'TND')).toBeCloseTo(100, 8);
  });

  it('converts zero to zero', () => {
    expect(convert(0, snapshot, 'IDR', 'USD')).toBe(0);
  });
});
