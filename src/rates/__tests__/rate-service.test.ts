import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrencyCode, RateProvider, RateSnapshot } from '../../core/types';
import { AllProvidersFailedError, RateService } from '../rate-service';

function snapshotFrom(provider: string, ageMs = 0): RateSnapshot {
  return {
    base: 'USD',
    rates: { USD: 1, IDR: 16_000, TND: 3.2 },
    updatedAt: new Date(Date.now() - ageMs),
    fetchedAt: new Date(Date.now() - ageMs),
    provider,
  };
}

function providerReturning(name: string): RateProvider {
  return { name, fetchRates: vi.fn(async () => snapshotFrom(name)) };
}

function providerFailing(name: string, reason = 'offline'): RateProvider {
  return {
    name,
    fetchRates: vi.fn(async () => {
      throw new Error(reason);
    }),
  };
}

const CURRENCIES: readonly CurrencyCode[] = ['USD', 'IDR', 'TND'];

describe('RateService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the first provider that succeeds', async () => {
    const primary = providerReturning('primary');
    const fallback = providerReturning('fallback');

    const { snapshot } = await new RateService([primary, fallback], 'USD', CURRENCIES).getRates();

    expect(snapshot.provider).toBe('primary');
    expect(fallback.fetchRates).not.toHaveBeenCalled();
  });

  it('falls through to the next provider when one fails', async () => {
    const primary = providerFailing('primary');
    const fallback = providerReturning('fallback');

    const { snapshot, stale } = await new RateService(
      [primary, fallback],
      'USD',
      CURRENCIES,
    ).getRates();

    expect(snapshot.provider).toBe('fallback');
    expect(stale).toBe(false);
  });

  it('throws when every provider fails and nothing is cached', async () => {
    const service = new RateService([providerFailing('a'), providerFailing('b')], 'USD', CURRENCIES);

    await expect(service.getRates()).rejects.toBeInstanceOf(AllProvidersFailedError);
  });

  it('serves a stale snapshot when every provider fails after a success', async () => {
    const flaky: RateProvider = {
      name: 'flaky',
      fetchRates: vi
        .fn<RateProvider['fetchRates']>()
        .mockResolvedValueOnce(snapshotFrom('flaky'))
        .mockRejectedValue(new Error('offline')),
    };
    const service = new RateService([flaky], 'USD', CURRENCIES);

    await service.getRates();
    const { snapshot, stale } = await service.getRates({ force: true });

    expect(stale).toBe(true);
    expect(snapshot.provider).toBe('flaky');
  });

  it('serves a fresh snapshot from memory instead of refetching', async () => {
    const provider = providerReturning('primary');
    const service = new RateService([provider], 'USD', CURRENCIES);

    await service.getRates();
    await service.getRates();

    expect(provider.fetchRates).toHaveBeenCalledTimes(1);
  });

  it('refetches when forced', async () => {
    const provider = providerReturning('primary');
    const service = new RateService([provider], 'USD', CURRENCIES);

    await service.getRates();
    await service.getRates({ force: true });

    expect(provider.fetchRates).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    const provider = providerReturning('primary');
    const service = new RateService([provider], 'USD', CURRENCIES);

    await Promise.all([service.getRates(), service.getRates(), service.getRates()]);

    expect(provider.fetchRates).toHaveBeenCalledTimes(1);
  });
});
