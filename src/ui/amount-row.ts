import type { Currency } from '../core/types';

export interface AmountRow {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
  /** Shows how this row's value was derived, e.g. `× 16,238.5`. */
  readonly rate: HTMLElement;
}

/** Builds one line of the rate board: a currency and its amount. */
export function createAmountRow(currency: Currency): AmountRow {
  const input = document.createElement('input');
  input.className = 'row__input';
  input.id = `amount-${currency.code}`;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = '0';

  const label = document.createElement('label');
  label.className = 'row__meta';
  label.htmlFor = input.id;
  label.append(span('row__code', currency.code), span('row__name', currency.name));

  const value = document.createElement('div');
  value.className = 'row__value';
  value.append(input);

  const rate = span('row__rate', '');

  const root = document.createElement('div');
  root.className = 'row';
  root.append(label, value, rate);

  return { root, input, rate };
}

function span(className: string, text: string): HTMLSpanElement {
  const created = document.createElement('span');
  created.className = className;
  if (text) created.textContent = text;
  return created;
}
