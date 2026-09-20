import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatDisplay,
  formatRate,
  formatRelativeTime,
  groupWhileTyping,
  parseAmount,
} from '../format';

describe('parseAmount', () => {
  it('parses plain numbers', () => {
    expect(parseAmount('42', 'USD')).toBe(42);
    expect(parseAmount('  3.5 ', 'USD')).toBe(3.5);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseAmount('3,5', 'USD')).toBe(3.5);
  });

  it('reads a clean grouping as thousands', () => {
    expect(parseAmount('1,234.56', 'USD')).toBe(1234.56);
    expect(parseAmount('1.234,56', 'USD')).toBe(1234.56);
    expect(parseAmount('16 000', 'IDR')).toBe(16_000);
    expect(parseAmount('1,000,000', 'IDR')).toBe(1_000_000);
    expect(parseAmount('1.234.567', 'IDR')).toBe(1_234_567);
    // What the app prints for 1 USD in rupiah, typed straight back in.
    expect(parseAmount('16,239', 'IDR')).toBe(16_239);
    expect(parseAmount('100.000', 'IDR')).toBe(100_000);
  });

  it('lets the currency settle a lone three-digit group', () => {
    // The dinar is quoted to three decimals, so this is an amount...
    expect(parseAmount('2.912', 'TND')).toBe(2.912);
    expect(parseAmount('2,912', 'TND')).toBe(2.912);
    // ...while the rupiah has none, so the same digits are thousands.
    expect(parseAmount('2.912', 'IDR')).toBe(2912);
    expect(parseAmount('2,912', 'USD')).toBe(2912);
  });

  it('keeps a decimal reading where the digits are not a clean grouping', () => {
    expect(parseAmount('0.500', 'USD')).toBe(0.5);
    expect(parseAmount('0,500', 'USD')).toBe(0.5);
    expect(parseAmount('12.34', 'USD')).toBe(12.34);
  });

  it('rejects input with no number in it', () => {
    expect(parseAmount('', 'USD')).toBeNull();
    expect(parseAmount('   ', 'USD')).toBeNull();
    expect(parseAmount('abc', 'USD')).toBeNull();
    expect(parseAmount('.', 'USD')).toBeNull();
  });

  it('drops a minus sign, since an amount to convert is never negative', () => {
    expect(parseAmount('-5', 'USD')).toBe(5);
  });
});

describe('formatAmount', () => {
  it('uses the precision the currency itself uses', () => {
    expect(formatAmount(1234.5, 'USD')).toBe('1,234.5');
    expect(formatAmount(20_310_303.88, 'IDR')).toBe('20,310,304');
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
      [16_239, 'IDR'],
      [1234.5, 'USD'],
      [2.912, 'TND'],
      [0.000_179, 'TND'],
    ] as const) {
      const formatted = formatAmount(amount, code);
      expect(parseAmount(formatted, code)).toBeCloseTo(Number(formatted.replaceAll(',', '')), 10);
    }
  });
});

describe('formatRate', () => {
  it('keeps large rates readable', () => {
    expect(formatRate(16_238.5)).toBe('16,238.5');
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

describe('groupWhileTyping', () => {
  it('groups digits as a long figure is entered', () => {
    expect(groupWhileTyping('2500000', 'IDR')).toBe('2,500,000');
    expect(groupWhileTyping('16239', 'IDR')).toBe('16,239');
    expect(groupWhileTyping('999', 'IDR')).toBe('999');
  });

  it('leaves a decimal point being typed alone', () => {
    expect(groupWhileTyping('1234.', 'USD')).toBe('1,234.');
    expect(groupWhileTyping('1234.5', 'USD')).toBe('1,234.5');
  });

  it('normalises a typed comma to a point, so one mark never does both jobs', () => {
    expect(groupWhileTyping('1234,5', 'USD')).toBe('1,234.5');
    expect(groupWhileTyping('2,912', 'TND')).toBe('2.912');
  });

  it('regroups digits already separated another way', () => {
    expect(groupWhileTyping('2.500.000', 'IDR')).toBe('2,500,000');
    expect(groupWhileTyping('2,500,000', 'IDR')).toBe('2,500,000');
  });

  it('refuses anything that is not part of a number', () => {
    expect(groupWhileTyping('abc', 'USD')).toBe('');
    expect(groupWhileTyping('12ab34', 'USD')).toBe('1,234');
  });

  it('agrees with parseAmount about where the decimal point falls', () => {
    for (const [typed, code] of [
      ['2500000', 'IDR'],
      ['2.500.000', 'IDR'],
      ['2,912', 'TND'],
      ['1234,5', 'USD'],
      ['0.500', 'USD'],
    ] as const) {
      const shown = groupWhileTyping(typed, code);
      expect(parseAmount(shown, code)).toBe(parseAmount(typed, code));
    }
  });
});

describe('formatDisplay', () => {
  it('shows a rupiah amount in thousands', () => {
    expect(formatDisplay(16_238.5, 'IDR')).toBe('16.2K');
    expect(formatDisplay(557_698, 'IDR')).toBe('557.7K');
    expect(formatDisplay(2_500_000, 'IDR')).toBe('2,500K');
  });

  it('leaves an amount below a thousand in full', () => {
    expect(formatDisplay(999, 'IDR')).toBe('999');
    expect(formatDisplay(0, 'IDR')).toBe('0');
  });

  it('leaves currencies that are not counted in millions alone', () => {
    expect(formatDisplay(16_238.5, 'USD')).toBe('16,238.5');
    expect(formatDisplay(2.912, 'TND')).toBe('2.912');
  });

  it('reads its own output back as the thousands it stands for', () => {
    expect(parseAmount(formatDisplay(2_500_000, 'IDR'), 'IDR')).toBe(2_500_000);
    expect(parseAmount('16K', 'IDR')).toBe(16_000);
  });
});
