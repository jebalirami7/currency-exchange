export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`Request to ${url} failed with status ${status}`);
    this.name = 'HttpError';
  }
}

const REQUEST_TIMEOUT_MS = 8_000;

/** Fetches JSON with a timeout, honouring an optional caller-supplied signal. */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const response = await fetch(url, {
    signal: composed,
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new HttpError(url, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Narrows a provider payload to the requested currencies, rejecting when the
 * provider does not quote all of them. Partial coverage must fail so the rate
 * service can fall through to the next provider.
 */
export function selectRates(
  provider: string,
  payload: Readonly<Record<string, unknown>>,
  base: string,
  currencies: readonly string[],
): Record<string, number> {
  const rates: Record<string, number> = {};

  for (const code of currencies) {
    if (code === base) {
      rates[code] = 1;
      continue;
    }

    const rate = payload[code];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`${provider} does not quote ${code}`);
    }
    rates[code] = rate;
  }

  return rates;
}
