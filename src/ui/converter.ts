import { convert, getRate } from '../core/convert';
import { CURRENCIES, DEFAULT_CURRENCY, getCurrency } from '../core/currencies';
import {
  formatAmount,
  formatDisplay,
  formatRate,
  formatRelativeTime,
  parseAmount,
} from '../core/format';
import type { CurrencyCode, RateSnapshot } from '../core/types';
import { RateService } from '../rates/rate-service';
import { createAmountCell, type AmountCell } from './amount-cell';
import {
  deleteAtCaret,
  fitToColumn,
  insertAtCaret,
  isTouch,
  regroup,
  selectOnFirstTap,
  useKeypadOnly,
} from './amount-input';
import { createKeypad, type Keypad, type KeypadKey } from './keypad';
import { requireElement } from './dom';

/** How often rates are refreshed in the background while the tab is open. */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

/** How long a changed value stays highlighted. Matches the CSS animation. */
const FLASH_MS = 700;

type StatusTone = 'loading' | 'live' | 'warning' | 'error';

/**
 * Every currency gets its own field, and they all hold the same value at once.
 * Typing in any one of them makes it the source; the rest are recomputed from
 * it, so there is no direction to choose and no pair to swap.
 */
export class Converter {
  readonly #rates: RateService;
  readonly #cells = new Map<CurrencyCode, AmountCell>();
  /**
   * The exact value behind each rendered field. Re-parsing the text would
   * read back only what was displayed, so handing the lead to a rounded
   * field would walk the amount a little further off every time.
   */
  readonly #rendered = new Map<CurrencyCode, { text: string; value: number }>();

  readonly #list = requireElement('#rows');
  readonly #keypadSlot = requireElement('#keypad');
  readonly #status = requireElement('#status');
  readonly #detail = requireElement('#status-detail');
  readonly #error = requireElement('#amount-error');
  readonly #refresh = requireElement<HTMLButtonElement>('#refresh');

  /** The field the user last typed in; every other field derives from it. */
  #source: CurrencyCode = DEFAULT_CURRENCY;
  #amount: number | null = 1;
  #snapshot: RateSnapshot | null = null;
  #keypad: Keypad | null = null;
  readonly #keypadOnly = isTouch();
  /**
   * Whether the next key starts a fresh amount rather than extending the one
   * on screen. It stands in for selecting the field's contents, which is what
   * a pointer device does on focus — but a selection on a phone is what
   * summons the cut/copy/paste bar.
   */
  #replacing = false;

  constructor(rates: RateService = new RateService()) {
    this.#rates = rates;
  }

  /** Builds the fields, wires events and loads the first snapshot. */
  async start(): Promise<void> {
    if (this.#keypadOnly) document.documentElement.classList.add('keypad-only');

    for (const currency of CURRENCIES) {
      const row = createAmountCell(currency);
      row.input.addEventListener('input', () => this.#onInput(currency.code));
      if (this.#keypadOnly) {
        useKeypadOnly(row.input);
      } else {
        selectOnFirstTap(row.input);
      }
      row.input.addEventListener('focus', () => {
        this.#replacing = true;
        this.#takeOver(currency.code);
        // Only scrolls if the keyboard has pushed the board out of view.
        row.root.scrollIntoView({ block: 'nearest' });
      });

      this.#cells.set(currency.code, row);
      this.#list.append(row.root);
    }

    const source = this.#cells.get(this.#source);
    if (source) {
      source.input.value = '1';
      fitToColumn(source.input);
    }
    this.#keypad = createKeypad((key) => this.#press(key));
    this.#keypadSlot.append(this.#keypad.root);

    this.#markSource();
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
    const row = this.#cells.get(code);
    if (!row) return;

    this.#replacing = false;
    regroup(row.input, code);
    fitToColumn(row.input);

    this.#source = code;
    this.#markSource();
    this.#amount = parseAmount(row.input.value, code);
    this.#error.hidden = row.input.value.trim() === '' || this.#amount !== null;

    this.#render();
  }

  /**
   * Focusing a field hands it the lead, so the rest read as derived from it.
   *
   * The amount comes from what that field already shows, not from the field
   * that held the lead before: clicking a row displaying 16,239 rupiah must
   * keep meaning 16,239 rupiah, rather than reinterpreting the previous
   * field's number as this currency.
   */
  #takeOver(code: CurrencyCode): void {
    const row = this.#cells.get(code);
    if (!row || this.#source === code) return;

    const rendered = this.#rendered.get(code);
    this.#source = code;
    this.#amount =
      rendered && rendered.text === row.input.value
        ? rendered.value
        : parseAmount(row.input.value, code);

    // A field being edited shows its amount in full: `16.2K` is for reading,
    // not for putting a caret into.
    if (this.#amount !== null) {
      row.input.value = formatAmount(this.#amount, code);
      row.input.setSelectionRange(row.input.value.length, row.input.value.length);
      fitToColumn(row.input);
    }

    this.#error.hidden = true;
    this.#markSource();
    this.#render();
  }

  #markSource(): void {
    for (const [code, row] of this.#cells) {
      row.root.classList.toggle('cell--source', code === this.#source);
    }

    // A currency quoted in whole units has no use for a decimal point.
    this.#keypad?.setDecimalAllowed(getCurrency(this.#source).decimals > 0);
  }

  /** Applies a keypad press to whichever field currently holds the amount. */
  #press(key: KeypadKey): void {
    const row = this.#cells.get(this.#source);
    if (!row) return;

    if (document.activeElement !== row.input) {
      this.#replacing = true;
      row.input.focus({ preventScroll: true });
    }

    // The first key after taking a field over starts the amount again, the
    // way typing over a selection would — except backspace, which trims a
    // digit off the amount rather than throwing all of it away.
    if (this.#replacing) {
      this.#replacing = false;

      if (key === 'backspace') {
        const end = row.input.value.length;
        row.input.setSelectionRange(end, end);
      } else {
        row.input.value = '';
        row.input.setSelectionRange(0, 0);
      }
    }

    if (key === 'backspace') {
      deleteAtCaret(row.input);
    } else {
      insertAtCaret(row.input, key);
    }

    this.#onInput(this.#source);
  }

  async #load({ force = false } = {}): Promise<void> {
    this.#refresh.disabled = true;
    if (!this.#snapshot) this.#setStatus('Loading rates…', '', 'loading');

    try {
      const { snapshot, stale } = await this.#rates.getRates({ force });
      this.#snapshot = snapshot;
      this.#render();
      this.#renderStatus(snapshot, stale);
    } catch {
      this.#setStatus(
        'Could not load rates',
        'Check your connection, then try again.',
        'error',
      );
    } finally {
      this.#refresh.disabled = false;
    }
  }

  #render(): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;

    for (const [code, row] of this.#cells) {
      const isSource = code === this.#source;
      row.rate.textContent = isSource
        ? ''
        : `× ${formatRate(getRate(snapshot, this.#source, code))}`;

      // Never overwrite what the user is editing, or a field they are sitting
      // in — a background refresh would otherwise move the caret out from
      // under them.
      if (isSource || row.input === document.activeElement) {
        fitToColumn(row.input);
        continue;
      }

      if (this.#amount === null) {
        this.#rendered.delete(code);
        row.input.value = '';
        fitToColumn(row.input);
        continue;
      }

      const value = convert(this.#amount, snapshot, this.#source, code);
      const next = formatDisplay(value, code);
      this.#rendered.set(code, { text: next, value });

      if (row.input.value !== next) {
        row.input.value = next;
        this.#flash(row);
      }
      fitToColumn(row.input);
    }
  }

  /** Briefly highlights a value that just changed, so the update is visible. */
  #flash(row: AmountCell): void {
    row.root.classList.remove('cell--changed');
    // Force a reflow so re-adding the class restarts the animation.
    void row.root.offsetWidth;
    row.root.classList.add('cell--changed');
    window.setTimeout(() => row.root.classList.remove('cell--changed'), FLASH_MS);
  }

  #renderStatus(snapshot: RateSnapshot, stale: boolean): void {
    const published = `Updated ${formatRelativeTime(snapshot.updatedAt)}`;
    const next = snapshot.nextUpdateAt
      ? `next ${formatRelativeTime(snapshot.nextUpdateAt)}`
      : null;
    const detail = [snapshot.provider, next].filter(Boolean).join(' · ');

    if (stale) {
      this.#setStatus('Offline', `Showing rates from ${formatRelativeTime(snapshot.updatedAt)}.`, 'warning');
      return;
    }

    this.#setStatus(published, detail, 'live');
  }

  #setStatus(message: string, detail: string, tone: StatusTone): void {
    this.#status.textContent = message;
    this.#detail.textContent = detail;
    this.#status.dataset['tone'] = tone;
  }
}
