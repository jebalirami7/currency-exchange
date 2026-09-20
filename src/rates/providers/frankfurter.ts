import type { CurrencyCode, RateProvider, RateSnapshot } from '../../core/types';
import { fetchJson, selectRates } from './http';

interface Payload {
  readonly date?: string;
  readonly rates?: Record<string, number>;
}

const ENDPOINT = 'https://api.frankfurter.app/latest';

/**
 * Frankfurter (European Central Bank reference rates) — the fallback source.
 *
 * The ECB set does not include every currency (TND among them), so this
 * provider rejects on partial coverage and only serves requests it can fully
 * satisfy. It exists to keep the app working if the primary source is down.
 */
export const frankfurter: RateProvider = {
  name: 'frankfurter.app',

  async fetchRates(
    base: CurrencyCode,
    currencies: readonly CurrencyCode[],
    signal?: AbortSignal,
  ): Promise<RateSnapshot> {
    const symbols = currencies.filter((code) => code !== base);
    const url = `${ENDPOINT}?base=${encodeURIComponent(base)}&symbols=${symbols.map(encodeURIComponent).join(',')}`;
    const payload = await fetchJson<Payload>(url, signal);

    if (!payload.rates) {
      throw new Error(`${frankfurter.name} returned no rates`);
    }

    return {
      base,
      rates: selectRates(frankfurter.name, payload.rates, base, currencies),
      updatedAt: payload.date ? new Date(`${payload.date}T00:00:00Z`) : new Date(),
      fetchedAt: new Date(),
      provider: frankfurter.name,
    };
  },
};
