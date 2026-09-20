import type { Currency } from '../core/types';

export interface AmountCell {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
  /** Shows how this column's value was derived, e.g. `× 16,238.5`. */
  readonly rate: HTMLElement;
}

/** Builds one column of the board: a currency and its amount. */
export function createAmountCell(currency: Currency): AmountCell {
  const input = document.createElement('input');
  input.className = 'cell__input';
  input.id = `amount-${currency.code}`;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = '0';

  const label = document.createElement('label');
  label.className = 'cell__label';
  label.htmlFor = input.id;
  label.append(span('cell__code', currency.code), span('cell__name', currency.name));

  const rate = span('cell__rate', '');

  const root = document.createElement('div');
  root.className = 'cell';
  root.append(label, input, rate);

  return { root, input, rate };
}

function span(className: string, text: string): HTMLSpanElement {
  const created = document.createElement('span');
  created.className = className;
  if (text) created.textContent = text;
  return created;
}
