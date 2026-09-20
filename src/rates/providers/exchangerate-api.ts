import type { CurrencyCode, RateProvider, RateSnapshot } from '../../core/types';
import { fetchJson, selectRates } from './http';

interface Payload {
  readonly result: string;
  readonly time_last_update_unix?: number;
  readonly rates?: Record<string, number>;
}

const ENDPOINT = 'https://open.er-api.com/v6/latest';

/**
 * open.er-api.com — the primary source. Free, keyless, CORS-enabled and it
 * quotes all three launch currencies including TND.
 */
export const exchangerateApi: RateProvider = {
  name: 'open.er-api.com',

  async fetchRates(
    base: CurrencyCode,
    currencies: readonly CurrencyCode[],
    signal?: AbortSignal,
  ): Promise<RateSnapshot> {
    const payload = await fetchJson<Payload>(
      `${ENDPOINT}/${encodeURIComponent(base)}`,
      signal,
    );

    if (payload.result !== 'success' || !payload.rates) {
      throw new Error(`${exchangerateApi.name} returned an unsuccessful response`);
    }

    return {
      base,
      rates: selectRates(exchangerateApi.name, payload.rates, base, currencies),
      updatedAt: payload.time_last_update_unix
        ? new Date(payload.time_last_update_unix * 1000)
        : new Date(),
      fetchedAt: new Date(),
      provider: exchangerateApi.name,
    };
  },
};
