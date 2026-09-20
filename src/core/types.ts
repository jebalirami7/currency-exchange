/** ISO 4217 alphabetic code, e.g. `USD`. */
export type CurrencyCode = string;

export interface Currency {
  /** ISO 4217 alphabetic code. Used as the key everywhere. */
  readonly code: CurrencyCode;
  /** Full English name, shown beside the code. */
  readonly name: string;
  /**
   * Decimal places the currency is quoted to. Stated here rather than taken
   * from `Intl`, whose currency data disagrees across engines — Chromium
   * gives the rupiah two decimals, Node gives it none.
   */
  readonly decimals: number;
}

/**
 * Exchange rates for one moment in time, all expressed against `base`.
 * `rates[base]` is always 1.
 */
export interface RateSnapshot {
  readonly base: CurrencyCode;
  readonly rates: Readonly<Record<CurrencyCode, number>>;
  /** When the provider last refreshed these rates. */
  readonly updatedAt: Date;
  /** When this client retrieved the snapshot. Drives cache freshness. */
  readonly fetchedAt: Date;
  /**
   * When the provider will publish again, when it says so. Rates are published
   * daily, so showing this is more honest than implying they tick live.
   */
  readonly nextUpdateAt?: Date;
  /** Identifier of the provider the snapshot came from. */
  readonly provider: string;
}

/**
 * A source of exchange rates. Adding a new source means implementing this
 * interface and registering it in `src/rates/rate-service.ts` — nothing else
 * in the app needs to change.
 */
export interface RateProvider {
  readonly name: string;
  /**
   * Resolves with a snapshot covering *every* requested currency, or rejects.
   * A provider that only partially covers `currencies` must reject, so that
   * the service can fall through to the next one.
   */
  fetchRates(
    base: CurrencyCode,
    currencies: readonly CurrencyCode[],
    signal?: AbortSignal,
  ): Promise<RateSnapshot>;
}
