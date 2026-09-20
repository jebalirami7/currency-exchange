import { convert, getRate } from '../core/convert';
import { CURRENCIES, DEFAULT_CURRENCY } from '../core/currencies';
import { formatAmount, formatRate, formatRelativeTime, parseAmount } from '../core/format';
import type { CurrencyCode, RateSnapshot } from '../core/types';
import { RateService } from '../rates/rate-service';
import { createAmountRow } from './amount-row';
import { requireElement } from './dom';

/** How often rates are refreshed in the background while the tab is open. */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

type StatusTone = 'info' | 'warning' | 'error';

/**
 * Every currency gets its own field, and they all hold the same value at once.
 * Typing in any one of them makes it the source; the rest are recomputed from
 * it, so there is no direction to choose and no pair to swap.
 */
export class Converter {
  readonly #rates: RateService;
  readonly #inputs = new Map<CurrencyCode, HTMLInputElement>();

  readonly #rows = requireElement('#rows');
  readonly #rate = requireElement('#rate');
  readonly #status = requireElement('#status');
  readonly #error = requireElement('#amount-error');
  readonly #refresh = requireElement<HTMLButtonElement>('#refresh');

  /** The field the user last typed in; every other field derives from it. */
  #source: CurrencyCode = DEFAULT_CURRENCY;
  #amount: number | null = 1;
  #snapshot: RateSnapshot | null = null;

  constructor(rates: RateService = new RateService()) {
    this.#rates = rates;
  }

  /** Builds the fields, wires events and loads the first snapshot. */
  async start(): Promise<void> {
    for (const currency of CURRENCIES) {
      const { root, input } = createAmountRow(currency);
      input.addEventListener('input', () => this.#onInput(currency.code));
      input.addEventListener('focus', () => input.select());

      this.#inputs.set(currency.code, input);
      this.#rows.append(root);
    }

    const sourceInput = this.#inputs.get(this.#source);
    if (sourceInput) sourceInput.value = '1';

    this.#refresh.addEventListener('click', () => void this.#load({ force: true }));

    // Rates go stale while a tab sits in the background; catch up on return.
    window.setInterval(() => void this.#load(), AUTO_REFRESH_MS);
    window.addEventListener('online', () => void this.#load({ force: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.#load();
    });

    // Show whatever the cache holds before the network answers.
    this.#snapshot = this.#rates.current;
    this.#render();

    await this.#load();
  }

  #onInput(code: CurrencyCode): void {
    const input = this.#inputs.get(code);
    if (!input) return;

    this.#source = code;
    this.#amount = parseAmount(input.value);
    this.#error.hidden = input.value.trim() === '' || this.#amount !== null;

    this.#render();
  }

  async #load({ force = false } = {}): Promise<void> {
    this.#refresh.disabled = true;

    try {
      const { snapshot, stale } = await this.#rates.getRates({ force });
      this.#snapshot = snapshot;
      this.#render();

      this.#setStatus(
        stale
          ? 'Offline — showing the last rates received.'
          : `${snapshot.provider} · updated ${formatRelativeTime(snapshot.updatedAt)}`,
        stale ? 'warning' : 'info',
      );
    } catch {
      this.#setStatus('Could not load exchange rates. Check your connection.', 'error');
    } finally {
      this.#refresh.disabled = false;
    }
  }

  #render(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;

    for (const [code, input] of this.#inputs) {
      // Never overwrite what the user is editing, or a field they are sitting
      // in — a background refresh would otherwise move the caret out from
      // under them.
      if (code === this.#source || input === document.activeElement) continue;

      input.value =
        this.#amount === null
          ? ''
          : formatAmount(convert(this.#amount, snapshot, this.#source, code), code);
    }

    this.#renderRate(snapshot);
  }

  /** A one-line summary of what the source currency is worth, e.g.
   * `1 USD = 16,238.5 IDR · 2.9117 TND`. */
  #renderRate(snapshot: RateSnapshot): void {
    const quotes = CURRENCIES.filter((currency) => currency.code !== this.#source).map(
      (currency) =>
        `${formatRate(getRate(snapshot, this.#source, currency.code))} ${currency.code}`,
    );

    this.#rate.textContent = `1 ${this.#source} = ${quotes.join(' · ')}`;
  }

  #setStatus(message: string, tone: StatusTone): void {
    this.#status.textContent = message;
    this.#status.dataset['tone'] = tone;
  }
}
