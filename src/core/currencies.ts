import type { Currency, CurrencyCode } from './types';

/**
 * The single source of truth for supported currencies.
 *
 * To support another currency, add one entry here — the selectors, the rate
 * table, the formatter and the providers all derive from this list. Symbols
 * and decimal precision are not configured: `Intl` already knows them for
 * every ISO 4217 code, and duplicating that here would only let it drift.
 */
export const CURRENCIES: readonly Currency[] = [
  { code: 'IDR', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'TND', name: 'Tunisian Dinar', flag: '🇹🇳' },
];

/** Currency the app converts *from* on first load. */
export const DEFAULT_FROM: CurrencyCode = 'USD';
/** Currency the app converts *to* on first load. */
export const DEFAULT_TO: CurrencyCode = 'TND';

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
