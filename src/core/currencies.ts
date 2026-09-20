import type { Currency, CurrencyCode } from './types';

/**
 * The single source of truth for supported currencies.
 *
 * To support another currency, add one entry here — the fields, the rate
 * summary, the formatter and the providers all derive from this list.
 *
 * `decimals` is how many decimal places the currency is quoted to in practice:
 * none for the rupiah, two for the dollar, three for the dinar.
 */
export const CURRENCIES: readonly Currency[] = [
  { code: 'IDR', name: 'Indonesian Rupiah', decimals: 0 },
  { code: 'USD', name: 'US Dollar', decimals: 2 },
  { code: 'TND', name: 'Tunisian Dinar', decimals: 3 },
];

/** Field that holds the amount on first load. */
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/**
 * Base currency requested from providers. Every provider quotes USD, and
 * cross-rates are derived from it, so this rarely needs to change.
 */
export const BASE_CURRENCY: CurrencyCode = 'USD';

export const CURRENCY_CODES: readonly CurrencyCode[] = CURRENCIES.map((c) => c.code);

const BY_CODE = new Map(CURRENCIES.map((currency) => [currency.code, currency]));

export function getCurrency(code: CurrencyCode): Currency {
  const currency = BY_CODE.get(code);
  if (!currency) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return currency;
}

export function isSupported(code: string): boolean {
  return BY_CODE.has(code);
}
