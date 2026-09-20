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

function currencyFormatter(code: CurrencyCode, fractionDigits?: number): Intl.NumberFormat {
  const key = `${code}:${fractionDigits ?? 'default'}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const created = new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
    ...(fractionDigits === undefined ? {} : { maximumFractionDigits: fractionDigits }),
  });

  cache.set(key, created);
  return created;
}

/**
 * Fraction digits for an amount in `code`.
 *
 * Currencies carry very different precisions (IDR none, TND three), and rates
 * between them span orders of magnitude. Converting 1 IDR to TND at the
 * currency's own precision would display `0.000`, so a small amount is given
 * enough digits to stay non-zero instead.
 */
function fractionDigitsFor(amount: number, code: CurrencyCode): number | undefined {
  const defaultDigits = currencyFormatter(code).resolvedOptions().maximumFractionDigits;
  const magnitude = Math.abs(amount);

  if (magnitude === 0 || Number(magnitude.toFixed(defaultDigits)) !== 0) {
    return undefined;
  }

  return Math.min(MAX_FRACTION_DIGITS, Math.ceil(-Math.log10(magnitude)) + 2);
}

/** Formats a converted amount, e.g. `$1,234.50` or `Rp 20,310,304`. */
export function formatCurrency(amount: number, code: CurrencyCode): string {
  return currencyFormatter(code, fractionDigitsFor(amount, code)).format(amount);
}

/** Formats a unit rate line, e.g. `1 USD = 2.9117 TND`. */
export function formatRate(rate: number, from: CurrencyCode, to: CurrencyCode): string {
  return `1 ${from} = ${formatRateValue(rate)} ${to}`;
}

/**
 * Formats a bare rate. Significant digits rather than fixed decimals, because
 * rates range from ~16,000 (USD to IDR) to ~0.00006 (IDR to USD).
 */
export function formatRateValue(rate: number): string {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    maximumSignificantDigits: RATE_SIGNIFICANT_DIGITS,
  }).format(rate);
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
 * Parses user input into a number, tolerating thousands separators and both
 * decimal conventions. Returns `null` for anything that is not a usable
 * non-negative amount.
 *
 * `1,234.56` and `1.234,56` are unambiguous: the separator that appears last
 * is the decimal point. A separator that repeats (`1,000,000`) can only be
 * grouping. A single separator (`3,5`) is read as a decimal point, since
 * `1,000` meaning one thousand cannot be told apart from `1,000` meaning one,
 * and the converter shows the result as the user types either way.
 */
export function parseAmount(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Keep digits, separators and a leading sign; drop spaces and symbols.
  const cleaned = trimmed.replace(/[^\d.,-]/g, '');
  if (cleaned === '') return null;

  const decimal = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.';
  const grouping = decimal === ',' ? '.' : ',';
  const withoutGrouping = cleaned.split(grouping).join('');

  const parts = withoutGrouping.split(decimal);
  const normalized =
    parts.length > 2
      ? parts.join('') // A repeated separator is grouping, not a decimal point.
      : parts.join('.');

  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
