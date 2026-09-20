import { convert, getRate } from '../core/convert';
import { CURRENCIES, DEFAULT_FROM, DEFAULT_TO } from '../core/currencies';
import {
  formatCurrency,
  formatRate,
  formatRateValue,
  formatRelativeTime,
  parseAmount,
} from '../core/format';
import type { RateSnapshot } from '../core/types';
import { RateService } from '../rates/rate-service';
import { populateCurrencySelect } from './currency-select';
import { requireElement } from './dom';

/** How often rates are refreshed in the background while the tab is open. */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

interface Elements {
  form: HTMLFormElement;
  amount: HTMLInputElement;
  from: HTMLSelectElement;
  to: HTMLSelectElement;
  result: HTMLOutputElement;
  swap: HTMLButtonElement;
  refresh: HTMLButtonElement;
  rate: HTMLElement;
  table: HTMLElement;
  status: HTMLElement;
  amountError: HTMLElement;
}

type StatusTone = 'info' | 'warning' | 'error';

export class Converter {
  readonly #el: Elements;
  readonly #rates: RateService;
  #snapshot: RateSnapshot | null = null;

  constructor(rates: RateService = new RateService()) {
    this.#rates = rates;
    this.#el = {
      form: requireElement<HTMLFormElement>('#converter'),
      amount: requireElement<HTMLInputElement>('#amount'),
      from: requireElement<HTMLSelectElement>('#from'),
      to: requireElement<HTMLSelectElement>('#to'),
      result: requireElement<HTMLOutputElement>('#result'),
      swap: requireElement<HTMLButtonElement>('#swap'),
      refresh: requireElement<HTMLButtonElement>('#refresh'),
      rate: requireElement('#rate'),
      table: requireElement('#rate-table'),
      status: requireElement('#status'),
      amountError: requireElement('#amount-error'),
    };
  }

  /** Renders the initial UI, wires events and loads the first snapshot. */
  async start(): Promise<void> {
    populateCurrencySelect(this.#el.from, DEFAULT_FROM);
    populateCurrencySelect(this.#el.to, DEFAULT_TO);

    this.#el.form.addEventListener('submit', (event) => event.preventDefault());
    this.#el.amount.addEventListener('input', () => this.#render());
    this.#el.from.addEventListener('change', () => this.#render());
    this.#el.to.addEventListener('change', () => this.#render());
    this.#el.swap.addEventListener('click', () => this.#swap());
    this.#el.refresh.addEventListener('click', () => void this.#load({ force: true }));

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

  async #load({ force = false } = {}): Promise<void> {
    this.#el.refresh.disabled = true;

    try {
      const { snapshot, stale } = await this.#rates.getRates({ force });
      this.#snapshot = snapshot;
      this.#render();

      if (stale) {
        this.#setStatus('Offline — showing the last rates received.', 'warning');
      } else {
        this.#setStatus(
          `${snapshot.provider} · updated ${formatRelativeTime(snapshot.updatedAt)}`,
          'info',
        );
      }
    } catch {
      this.#setStatus('Could not load exchange rates. Check your connection.', 'error');
    } finally {
      this.#el.refresh.disabled = false;
    }
  }

  #swap(): void {
    const { from, to } = this.#el;
    [from.value, to.value] = [to.value, from.value];
    this.#render();
  }

  #render(): void {
    const amount = parseAmount(this.#el.amount.value);
    const from = this.#el.from.value;
    const to = this.#el.to.value;

    const invalid = this.#el.amount.value.trim() !== '' && amount === null;
    this.#el.amountError.hidden = !invalid;

    const snapshot = this.#snapshot;
    if (!snapshot) {
      this.#el.result.textContent = '—';
      return;
    }

    this.#el.result.textContent =
      amount === null ? '—' : formatCurrency(convert(amount, snapshot, from, to), to);
    this.#el.rate.textContent = formatRate(getRate(snapshot, from, to), from, to);
    this.#renderTable(snapshot, from);
  }

  #renderTable(snapshot: RateSnapshot, from: string): void {
    const rows = CURRENCIES.filter((currency) => currency.code !== from).map((currency) => {
      const row = document.createElement('div');
      row.className = 'table__row';

      const term = document.createElement('dt');
      term.textContent = `${currency.flag} ${currency.name}`;

      const value = document.createElement('dd');
      value.textContent = `${formatRateValue(getRate(snapshot, from, currency.code))} ${currency.code}`;

      row.append(term, value);
      return row;
    });

    this.#el.table.replaceChildren(...rows);
  }

  #setStatus(message: string, tone: StatusTone): void {
    this.#el.status.textContent = message;
    this.#el.status.dataset['tone'] = tone;
  }
}
