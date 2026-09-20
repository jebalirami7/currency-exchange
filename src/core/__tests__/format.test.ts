import { describe, expect, it } from 'vitest';
import { formatAmount, formatRate, formatRelativeTime, parseAmount } from '../format';

/** The app groups thousands with a narrow no-break space, not a comma. */
const GROUP = ' ';

describe('parseAmount', () => {
  it('parses plain numbers', () => {
    expect(parseAmount('42')).toBe(42);
    expect(parseAmount('  3.5 ')).toBe(3.5);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseAmount('3,5')).toBe(3.5);
  });

  it('strips thousands separators in either convention', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('16 000')).toBe(16_000);
    expect(parseAmount('1,000,000')).toBe(1_000_000);
    expect(parseAmount('1.234.567')).toBe(1_234_567);
  });

  it('rejects empty, negative and non-numeric input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });
});

describe('formatAmount', () => {
  it('uses the precision the currency itself uses', () => {
    expect(formatAmount(1234.5, 'USD')).toBe(`1${GROUP}234.5`);
    expect(formatAmount(20_310_303.88, 'IDR')).toBe(`20${GROUP}310${GROUP}304`);
    expect(formatAmount(2.9117, 'TND')).toBe('2.912');
  });

  it('adds precision rather than displaying a small amount as zero', () => {
    // 1 IDR is worth this much in TND; three decimals would round it away.
    expect(formatAmount(0.000_179, 'TND')).toBe('0.000179');
    expect(formatAmount(0.000_061_58, 'USD')).toBe('0.0000616');
  });

  it('formats zero at the default precision', () => {
    expect(formatAmount(0, 'USD')).toBe('0');
  });

  it('round-trips back through parseAmount', () => {
    for (const [amount, code] of [
      [20_310_303.88, 'IDR'],
      [1234.5, 'USD'],
      [0.000_179, 'TND'],
    ] as const) {
      const formatted = formatAmount(amount, code);
      expect(parseAmount(formatted)).toBeCloseTo(Number(formatted.replaceAll(GROUP, '')), 10);
    }
  });
});

describe('formatRate', () => {
  it('keeps large rates readable', () => {
    expect(formatRate(16_238.5)).toBe(`16${GROUP}238.5`);
  });

  it('keeps small rates meaningful', () => {
    expect(formatRate(0.000_061_581_9)).toBe('0.0000615819');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-01-01T12:00:00Z');

  it('describes minutes ago', () => {
    expect(formatRelativeTime(new Date('2026-01-01T11:57:00Z'), now)).toBe('3 minutes ago');
  });

  it('describes hours ago', () => {
    expect(formatRelativeTime(new Date('2026-01-01T09:00:00Z'), now)).toBe('3 hours ago');
  });

  it('describes seconds ago', () => {
    expect(formatRelativeTime(new Date('2026-01-01T11:59:58Z'), now)).toBe('2 seconds ago');
  });
});
