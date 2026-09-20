import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CurrencyCode, RateProvider } from '../../core/types';
import { RateService } from '../../rates/rate-service';
import { Converter } from '../converter';

const CODES: readonly CurrencyCode[] = ['IDR', 'USD', 'TND'];

const provider: RateProvider = {
  name: 'test',
  fetchRates: async () => ({
    base: 'USD',
    rates: { USD: 1, IDR: 16_238.5, TND: 2.9117 },
    updatedAt: new Date(),
    fetchedAt: new Date(),
    provider: 'test',
  }),
};

/** The real markup, so the test cannot drift from the page it exercises. */
const PAGE = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function field(code: CurrencyCode): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`#amount-${code}`);
  if (!input) throw new Error(`No field for ${code}`);
  return input;
}

function values(): Record<string, string> {
  return Object.fromEntries(CODES.map((code) => [code, field(code).value]));
}

function type(code: CurrencyCode, text: string): void {
  const input = field(code);
  input.dispatchEvent(new Event('focus'));
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

async function mount(): Promise<void> {
  document.body.innerHTML = PAGE.slice(PAGE.indexOf('<main'), PAGE.indexOf('</main>') + 7);
  await new Converter(new RateService([provider], 'USD', CODES)).start();
}

describe('Converter', () => {
  beforeEach(() => localStorage.clear());

  it('fills every field from the default amount', async () => {
    await mount();
    expect(values()).toEqual({ USD: '1', IDR: '16,239', TND: '2.912' });
  });

  it('keeps the amounts when the lead moves to another field', async () => {
    await mount();

    // Clicking the rupiah field must mean "16,239 rupiah", not "1 rupiah".
    field('IDR').dispatchEvent(new Event('focus'));

    expect(field('IDR').value).toBe('16,239');
    expect(Number(field('USD').value)).toBeCloseTo(1, 3);
    expect(Number(field('TND').value)).toBeCloseTo(2.912, 2);
  });

  it('converts from whichever field was typed in last', async () => {
    await mount();

    type('TND', '100');
    expect(Number(values()['USD'])).toBeCloseTo(34.34, 2);
    expect(values()['IDR']).toBe('557,698');

    type('IDR', '1,000,000');
    expect(Number(values()['USD'])).toBeCloseTo(61.58, 2);
  });

  it('refuses characters that are not part of a number', async () => {
    await mount();

    type('USD', 'abc');
    expect(values()).toEqual({ USD: '', IDR: '', TND: '' });

    type('USD', '2');
    expect(values()['IDR']).toBe('32,477');
  });

  it('groups the digits in the field being typed into', async () => {
    await mount();

    type('IDR', '2500000');
    expect(values()['IDR']).toBe('2,500,000');
    expect(Number(values()['USD'])).toBeCloseTo(153.96, 2);
  });
});
