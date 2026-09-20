import { BASE_CURRENCY, CURRENCY_CODES } from '../core/currencies';
import type { CurrencyCode, RateProvider, RateSnapshot } from '../core/types';
import { readCachedSnapshot, writeCachedSnapshot } from './cache';
import { exchangerateApi } from './providers/exchangerate-api';
import { frankfurter } from './providers/frankfurter';

/**
 * Providers are tried in order until one returns a snapshot covering every
 * requested currency. Add a source by implementing `RateProvider` and
 * appending it here.
 */
const PROVIDERS: readonly RateProvider[] = [exchangerateApi, frankfurter];

/**
 * How long a snapshot is served without hitting the network again. Measured
 * from when this client fetched it, not from the provider's own timestamp:
 * providers publish once a day, so the latter would refetch on every keystroke.
 */
const FRESH_FOR_MS = 10 * 60 * 1000;

export interface RateResult {
  readonly snapshot: RateSnapshot;
  /**
   * True when every provider failed and the snapshot came from the cache.
   * The UI warns the user rather than presenting stale rates as live.
   */
  readonly stale: boolean;
}

export class AllProvidersFailedError extends Error {
  constructor(readonly failures: readonly Error[]) {
    super('Could not reach any exchange rate provider');
    this.name = 'AllProvidersFailedError';
  }
}

export class RateService {
  #snapshot: RateSnapshot | null = readCachedSnapshot();
  #inFlight: Promise<RateSnapshot> | null = null;

  constructor(
    private readonly providers: readonly RateProvider[] = PROVIDERS,
    private readonly base: CurrencyCode = BASE_CURRENCY,
    private readonly currencies: readonly CurrencyCode[] = CURRENCY_CODES,
  ) {}

  /** The last snapshot obtained, without triggering a fetch. */
  get current(): RateSnapshot | null {
    return this.#snapshot;
  }

  /**
   * Returns rates, fetching only when the cached snapshot is older than
   * `FRESH_FOR_MS` or when `force` is set. Concurrent calls share one request.
   */
  async getRates({ force = false } = {}): Promise<RateResult> {
    const cached = this.#snapshot;
    if (!force && cached && this.#isFresh(cached)) {
      return { snapshot: cached, stale: false };
    }

    this.#inFlight ??= this.#fetchFromProviders().finally(() => {
      this.#inFlight = null;
    });

    try {
      const snapshot = await this.#inFlight;
      return { snapshot, stale: false };
    } catch (error) {
      // Showing rates from five minutes ago beats showing nothing at all,
      // as long as the UI says they may be out of date.
      if (cached) {
        return { snapshot: cached, stale: true };
      }
      throw error;
    }
  }

  async #fetchFromProviders(): Promise<RateSnapshot> {
    const failures: Error[] = [];

    for (const provider of this.providers) {
      try {
        const snapshot = await provider.fetchRates(this.base, this.currencies);
        this.#snapshot = snapshot;
        writeCachedSnapshot(snapshot);
        return snapshot;
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    throw new AllProvidersFailedError(failures);
  }

  #isFresh(snapshot: RateSnapshot): boolean {
    return Date.now() - snapshot.fetchedAt.getTime() < FRESH_FOR_MS;
  }
}
