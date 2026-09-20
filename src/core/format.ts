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

/** Below this an amount is short enough to read in full. */
const COMPACT_FROM = 1000;

/**
 * Formats an amount for a field the reader is not editing.
 *
 * A currency marked `compact` is shown in thousands — `16.2K`, `2,500K` —
 * because eight digits in a column a third of a phone wide are read by
 * counting, not at a glance. The exact value is kept alongside the text, so
 * the rounding here never reaches the conversion.
 */
export function formatDisplay(amount: number, code: CurrencyCode): string {
  if (!getCurrency(code).compact || Math.abs(amount) < COMPACT_FROM) {
    return formatAmount(amount, code);
  }

  const thousands = amount / 1000;
  const digits = Math.abs(thousands) < COMPACT_FROM ? 1 : 0;

  return `${formatter(
    `decimal:${digits}`,
    () =>
      new Intl.NumberFormat(DISPLAY_LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      }),
  ).format(thousands)}K`;
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
 * Splits a cleaned amount into its integer digits and, where the input has a
 * decimal point at all, the digits after it.
 *
 * Both the parser and the as-you-type grouping go through here, so what a
 * field shows and what it is worth can never disagree about where the
 * decimal point falls.
 */
function splitAmount(
  cleaned: string,
  code: CurrencyCode,
): { integer: string; fraction: string | null } {
  const decimals = currencyPrecision(code);
  const lastSeparator = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));

  // Nothing can follow a decimal point in a currency that has no decimal
  // places, and a string without a separator has no fraction either.
  if (lastSeparator === -1 || decimals === 0) {
    return { integer: onlyDigits(cleaned), fraction: null };
  }

  const integer = onlyDigits(cleaned.slice(0, lastSeparator));
  const fraction = onlyDigits(cleaned.slice(lastSeparator + 1));

  return marksGrouping(integer, fraction, decimals)
    ? { integer: integer + fraction, fraction: null }
    : { integer, fraction };
}

/**
 * Whether the last separator groups thousands rather than marking decimals.
 *
 * More digits follow it than the currency has decimal places — so `1,500`
 * dollars is fifteen hundred, while `1,50` is a dollar fifty and `2,912`
 * dinars, quoted to three, is just under three. Grouping also never starts a
 * number with zero, which keeps `0,500` a fraction.
 *
 * The digit count is what lets a figure regroup as it is typed: adding a
 * digit to `2,500` gives `2,5000`, whose four trailing digits can only be
 * grouping mid-entry.
 */
function marksGrouping(integer: string, fraction: string, decimals: number): boolean {
  if (integer === '' || integer.startsWith('0')) return false;
  return fraction.length > decimals;
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

/** Digits and separators only; spaces, signs and symbols are dropped. */
function clean(input: string): string {
  return input.trim().replace(/[^\d.,]/g, '');
}

/**
 * Regroups an amount as it is being typed, so a long figure stays readable
 * while it is entered rather than only once it is converted.
 *
 * The decimal point is normalised to `.` so that one field never shows commas
 * doing both jobs at once, and anything that is not a digit or a separator is
 * dropped, which is how a letter gets refused.
 */
export function groupWhileTyping(input: string, code: CurrencyCode): string {
  const cleaned = clean(input);
  if (cleaned === '') return '';

  const { integer, fraction } = splitAmount(cleaned, code);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return fraction === null ? grouped : `${grouped}.${fraction}`;
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
  const cleaned = clean(input);
  if (cleaned === '') return null;

  const { integer, fraction } = splitAmount(cleaned, code);
  const value = Number(fraction === null ? integer : `${integer}.${fraction}`);
  if (!Number.isFinite(value) || value < 0) return null;

  // `16.2K` reads back as the thousands it stands for, so a compact amount
  // means the same thing whether it is displayed or typed.
  return /k\s*$/i.test(input.trim()) ? value * 1000 : value;
}
