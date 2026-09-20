import type { CurrencyCode } from './types';

/**
 * Amounts are always formatted in one locale rather than each currency's own,
 * so that a single screen never mixes decimal conventions or text directions.
 */
const DISPLAY_LOCALE = 'en-US';

/**
 * Thousands separator, used for every number the app prints.
 *
 * A comma would be ambiguous once a formatted value lands back in an editable
 * field: `parseAmount` cannot tell `16,238` meaning sixteen thousand from
 * `16,238` meaning sixteen point two. A space has no such second reading, and
 * `parseAmount` strips it.
 */
const GROUP_SEPARATOR = ' ';

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

/** Formats `amount`, substituting the app's own thousands separator. */
function format(numberFormat: Intl.NumberFormat, amount: number): string {
  return numberFormat
    .formatToParts(amount)
    .map((part) => (part.type === 'group' ? GROUP_SEPARATOR : part.value))
    .join('');
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

/** How many decimal places the currency itself uses. `Intl` already knows. */
function currencyPrecision(code: CurrencyCode): number {
  const resolved = formatter(
    `currency:${code}`,
    () => new Intl.NumberFormat(DISPLAY_LOCALE, { style: 'currency', currency: code }),
  ).resolvedOptions();

  // Always present for a currency formatter; the fallback satisfies the type.
  return resolved.maximumFractionDigits ?? 2;
}

/**
 * Formats an amount for its editable field: no currency symbol, since the
 * field is labelled with one, and precision suited to the currency.
 */
export function formatAmount(amount: number, code: CurrencyCode): string {
  const digits = fractionDigitsFor(amount, code);
  return format(
    formatter(
      `decimal:${digits}`,
      () =>
        new Intl.NumberFormat(DISPLAY_LOCALE, {
          minimumFractionDigits: 0,
          maximumFractionDigits: digits,
        }),
    ),
    amount,
  );
}

/**
 * Formats a bare exchange rate. Significant digits rather than fixed decimals,
 * because rates range from ~16,000 (USD to IDR) to ~0.00006 (IDR to USD).
 */
export function formatRate(rate: number): string {
  return format(
    formatter(
      'rate',
      () =>
        new Intl.NumberFormat(DISPLAY_LOCALE, {
          maximumSignificantDigits: RATE_SIGNIFICANT_DIGITS,
        }),
    ),
    rate,
  );
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
 * `1,000` meaning one thousand cannot be told apart from `1,000` meaning one —
 * which is exactly why the app groups with a space when it formats.
 */
export function parseAmount(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Keep digits, separators and a leading sign; drop spaces and symbols.
  const cleaned = trimmed.replace(/[^\d.,-]/g, '');
  if (cleaned === '') return null;

  const decimal = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.';
  const grouping = decimal === ',' ? '.' : ',';

  const parts = cleaned.split(grouping).join('').split(decimal);
  // A repeated separator is grouping, not a decimal point.
  const normalized = parts.length > 2 ? parts.join('') : parts.join('.');

  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
