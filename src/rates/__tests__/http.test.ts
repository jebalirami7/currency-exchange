import { describe, expect, it } from 'vitest';
import { selectRates } from '../providers/http';

describe('selectRates', () => {
  it('quotes the base currency as 1 without consulting the payload', () => {
    expect(selectRates('test', { IDR: 16_000 }, 'USD', ['USD', 'IDR'])).toEqual({
      USD: 1,
      IDR: 16_000,
    });
  });

  it('rejects partial coverage so the service can fall through', () => {
    expect(() => selectRates('test', { IDR: 16_000 }, 'USD', ['USD', 'IDR', 'TND'])).toThrow(
      /does not quote TND/,
    );
  });

  it('rejects non-positive and non-numeric rates', () => {
    expect(() => selectRates('test', { TND: 0 }, 'USD', ['TND'])).toThrow();
    expect(() => selectRates('test', { TND: '3.2' }, 'USD', ['TND'])).toThrow();
  });
});
