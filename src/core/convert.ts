import type { CurrencyCode, RateSnapshot } from './types';

/**
 * Cross-rate between two currencies, derived from a snapshot quoted against a
 * single base: `from -> base -> to`.
 */
export function getRate(
  snapshot: RateSnapshot,
  from: CurrencyCode,
  to: CurrencyCode,
): number {
  const fromRate = snapshot.rates[from];
  const toRate = snapshot.rates[to];

  if (fromRate === undefined) {
    throw new Error(`Snapshot has no rate for ${from}`);
  }
  if (toRate === undefined) {
    throw new Error(`Snapshot has no rate for ${to}`);
  }
  if (fromRate === 0) {
    throw new Error(`Rate for ${from} is zero`);
  }

  return toRate / fromRate;
}

export function convert(
  amount: number,
  snapshot: RateSnapshot,
  from: CurrencyCode,
  to: CurrencyCode,
): number {
  return amount * getRate(snapshot, from, to);
}
