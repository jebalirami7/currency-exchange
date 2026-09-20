import { getCurrency } from './currencies';
import type { CurrencyCode } from './types';

/**
 * Amounts are always formatted in one locale rather than each currency's own,
 * so that a single screen never mixes decimal conventions or text directions.
 */
const DISPLAY_LOCALE = 'en-US';

/** Enough precision to stay meaningful; beyond this, rates are noise. */
const RATE_SIGNIFICANT_DIGITS = 6;
const MAX_FRACTION_DIGITS = 8;

/** Formatters are expensive to build, so they are created once and reused. */
const cache = new Map<string, Intl.NumberFormat>();

function formatter(key: string, build: () => Intl.NumberFormat): Intl.NumberFormat {
  const cached = cache.get(key);
  if (cached) return cached;

  const created = build();
  cache.set(key, created);
  return created;
}

/**
 * Fraction digits for an amount in `code`.
 *
 * Currencies carry very different precisions (IDR none, TND three), and rates
 * between them span orders of magnitude. Showing 1 IDR in TND at TND's own
 * precision would display `0.000`, so a small amount is given enough digits to
 * stay non-zero instead.
 */
function fractionDigitsFor(amount: number, code: CurrencyCode): number {
  const defaultDigits = currencyPrecision(code);
  const magnitude = Math.abs(amount);

  if (magnitude === 0 || Number(magnitude.toFixed(defaultDigits)) !== 0) {
    return defaultDigits;
  }

  return Math.min(MAX_FRACTION_DIGITS, Math.ceil(-Math.log10(magnitude)) + 2);
}

/** How many decimal places the currency is quoted to. */
function currencyPrecision(code: CurrencyCode): number {
  return getCurrency(code).decimals;
}

/**
 * Formats an amount for its editable field: no currency symbol, since the
 * field is labelled with one, and precision suited to the currency.
 */
export function formatAmount(amount: number, code: CurrencyCode): string {
  const digits = fractionDigitsFor(amount, code);
  return formatter(
    `decimal:${digits}`,
    () =>
      new Intl.NumberFormat(DISPLAY_LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      }),
  ).format(amount);
}

/**
 * Formats a bare exchange rate. Significant digits rather than fixed decimals,
 * because rates range from ~16,000 (USD to IDR) to ~0.00006 (IDR to USD).
 */
export function formatRate(rate: number): string {
  return formatter(
    'rate',
    () =>
      new Intl.NumberFormat(DISPLAY_LOCALE, {
        maximumSignificantDigits: RATE_SIGNIFICANT_DIGITS,
      }),
  ).format(rate);
}

/** Renders a timestamp as a short relative phrase, e.g. `3 minutes ago`. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const units: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
    ['year', Number.POSITIVE_INFINITY],
  ];

  const relative = new Intl.RelativeTimeFormat(DISPLAY_LOCALE, { numeric: 'auto' });
  let value = Math.round((date.getTime() - now.getTime()) / 1000);

  for (const [unit, size] of units) {
    if (Math.abs(value) < size) {
      return relative.format(Math.round(value), unit);
    }
    value /= size;
  }

  return relative.format(Math.round(value), 'year');
}

/**
 * Parses an amount the user typed into a field holding `code`, tolerating
 * thousands separators and both decimal conventions. Returns `null` for
 * anything that is not a usable non-negative amount.
 *
 * A lone separator is genuinely ambiguous — `2.912` is two thousand nine
 * hundred and twelve or two point nine one two — so the currency decides.
 * The dinar is quoted to three decimals, so `2.912` in a TND field is an
 * amount; the rupiah has none, so `16,239` in an IDR field is thousands.
 */
export function parseAmount(input: string, code: CurrencyCode): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Keep digits, separators and a leading sign; drop spaces and symbols.
  const cleaned = trimmed.replace(/[^\d.,-]/g, '');
  if (cleaned === '') return null;

  // Whichever separator comes last would be the decimal point, if there is one.
  const decimal = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.';
  const withoutOther = cleaned.split(decimal === ',' ? '.' : ',').join('');
  const parts = withoutOther.split(decimal);

  const digits = isGrouped(withoutOther, decimal, parts, code)
    ? parts.join('')
    : parts.join('.');

  const value = Number(digits);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Whether the separators in `text` group thousands rather than mark decimals. */
function isGrouped(
  text: string,
  decimal: string,
  parts: readonly string[],
  code: CurrencyCode,
): boolean {
  // A separator that repeats can only be grouping: `1,000,000`.
  if (parts.length > 2) return true;

  const fraction = parts[1];
  if (fraction === undefined) return false;

  // Grouping is three digits at a time, and never starts a number with zero,
  // which keeps `0.500` a decimal.
  if (!new RegExp(`^[1-9]\\d{0,2}(\\${decimal}\\d{3})+$`).test(text)) return false;

  // ...but three digits is also exactly how the dinar is quoted.
  return fraction.length !== currencyPrecision(code);
}
