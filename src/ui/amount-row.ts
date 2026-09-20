import type { Currency } from '../core/types';

export interface AmountRow {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
  /** Shows how this row's value was derived, e.g. `× 16 238.5`. */
  readonly rate: HTMLElement;
}

/** Builds the labelled amount field for one currency. */
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
  label.className = 'row__label';
  label.htmlFor = input.id;
  label.append(
    element('span', 'row__flag', currency.flag, { ariaHidden: true }),
    element('span', 'row__code', currency.code),
    element('span', 'row__name', currency.name),
  );

  const rate = element('span', 'row__rate', '');
  const amount = element('div', 'row__amount', '');
  amount.append(input, rate);

  const root = element('div', 'row', '');
  root.append(label, amount);

  return { root, input, rate };
}

function element(
  tag: 'span' | 'div',
  className: string,
  text: string,
  { ariaHidden = false } = {},
): HTMLElement {
  const created = document.createElement(tag);
  created.className = className;
  if (text) created.textContent = text;
  if (ariaHidden) created.ariaHidden = 'true';
  return created;
}
