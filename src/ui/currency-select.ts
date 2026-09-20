import { CURRENCIES } from '../core/currencies';
import type { CurrencyCode } from '../core/types';

/** Fills a `<select>` with one option per supported currency. */
export function populateCurrencySelect(
  select: HTMLSelectElement,
  selected: CurrencyCode,
): void {
  select.replaceChildren(
    ...CURRENCIES.map((currency) => {
      const option = document.createElement('option');
      option.value = currency.code;
      option.textContent = `${currency.flag} ${currency.code}`;
      option.title = currency.name;
      return option;
    }),
  );
  select.value = selected;
}
