import type { Currency } from '../core/types';

export interface AmountRow {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
}

/** Builds the labelled amount field for one currency. */
export function createAmountRow(currency: Currency): AmountRow {
  const root = document.createElement('div');
  root.className = 'row';

  const input = document.createElement('input');
  input.className = 'row__input';
  input.id = `amount-${currency.code}`;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const label = document.createElement('label');
  label.className = 'row__label';
  label.htmlFor = input.id;
  label.append(
    span('row__flag', currency.flag, { hidden: true }),
    span('row__code', currency.code),
    span('row__name', currency.name),
  );

  root.append(label, input);
  return { root, input };
}

function span(className: string, text: string, { hidden = false } = {}): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  if (hidden) element.ariaHidden = 'true';
  return element;
}
