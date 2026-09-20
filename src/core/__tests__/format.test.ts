import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatRate,
  formatRateValue,
  formatRelativeTime,
  parseAmount,
} from '../format';

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

describe('formatCurrency', () => {
  it('uses each currency’s symbol and default precision', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
    expect(formatCurrency(20_310_303.88, 'IDR')).toBe('Rp\u00a020,310,304');
  });

  it('formats every currency in one locale, left to right', () => {
    expect(formatCurrency(1234.5, 'TND')).toBe('TND\u00a01,234.500');
  });

  it('adds precision rather than displaying a small amount as zero', () => {
    // 1 IDR in TND: three decimals would round this away entirely.
    expect(formatCurrency(0.000_179, 'TND')).toBe('TND\u00a00.000179');
    expect(formatCurrency(0.000_061_58, 'USD')).toBe('$0.0000616');
  });

  it('still formats zero at the default precision', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });
});

describe('formatRateValue', () => {
  it('keeps large rates readable', () => {
    expect(formatRateValue(16_238.5)).toBe('16,238.5');
  });

  it('keeps small rates meaningful', () => {
    expect(formatRateValue(0.000_061_581_9)).toBe('0.0000615819');
  });
});

describe('formatRate', () => {
  it('reads as a unit rate', () => {
    expect(formatRate(2.9117, 'USD', 'TND')).toBe('1 USD = 2.9117 TND');
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
