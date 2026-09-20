import { groupWhileTyping } from '../core/format';
import type { CurrencyCode } from '../core/types';

/**
 * Selects the whole amount when a field is first tapped, so typing replaces it.
 *
 * Selecting on `focus` alone is unreliable: focus fires before the browser has
 * placed the caret from the click, so the release collapses the selection and
 * the caret lands wherever the finger did — selected on a keyboard tab, but
 * dropped mid-number on a tap. Claiming the release is what makes it stick.
 * A second tap, once the field already holds focus, still places the caret
 * exactly where it was aimed.
 */
export function selectOnFirstTap(input: HTMLInputElement): void {
  let pending = false;

  input.addEventListener('pointerdown', () => {
    pending = document.activeElement !== input;
  });

  input.addEventListener('pointerup', (event) => {
    if (!pending) return;
    pending = false;
    event.preventDefault();
    input.select();
  });

  // Keyboard focus never goes through a pointer, so it still needs this.
  input.addEventListener('focus', () => {
    if (!pending) input.select();
  });
}

/**
 * Regroups the digits in place as they are typed, leaving the caret in front
 * of the same digit it was in front of before the separators moved.
 */
export function regroup(input: HTMLInputElement, code: CurrencyCode): void {
  const before = input.value;
  const after = groupWhileTyping(before, code);
  if (after === before) return;

  const caret = input.selectionStart ?? before.length;
  input.value = after;

  const position =
    caret >= before.length
      ? after.length
      : offsetAfterDigits(after, countDigits(before.slice(0, caret)));

  input.setSelectionRange(position, position);
}

function countDigits(text: string): number {
  return (text.match(/\d/g) ?? []).length;
}

/** The offset just past the `count`-th digit of `text`. */
function offsetAfterDigits(text: string, count: number): number {
  if (count === 0) return 0;

  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index]! >= '0' && text[index]! <= '9') {
      seen += 1;
      if (seen === count) return index + 1;
    }
  }

  return text.length;
}

/**
 * Steps the type size down as a figure gets longer.
 *
 * Side by side, each currency has roughly a third of the screen, and a rupiah
 * amount runs to ten characters or more. Tiers rather than a fluid size keep
 * the three columns visually level with one another.
 */
export function fitToColumn(input: HTMLInputElement): void {
  const length = input.value.length;
  input.dataset['size'] = length <= 5 ? 'l' : length <= 7 ? 'm' : length <= 9 ? 's' : 'xs';
}

/** Replaces the selection, or inserts at the caret, and leaves the caret after it. */
export function insertAtCaret(input: HTMLInputElement, text: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;

  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  input.setSelectionRange(start + text.length, start + text.length);
}

/** Deletes the selection, or the digit before the caret. */
export function deleteAtCaret(input: HTMLInputElement): void {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? start;

  if (start !== end) {
    input.value = input.value.slice(0, start) + input.value.slice(end);
    input.setSelectionRange(start, start);
    return;
  }

  // Step back over a grouping separator, so a press always removes a digit
  // rather than a comma the app put there itself.
  let from = start - 1;
  if (input.value[from] === ',') from -= 1;
  if (from < 0) return;

  input.value = input.value.slice(0, from) + input.value.slice(start);
  input.setSelectionRange(from, from);
}

/**
 * Asks the browser not to raise the system keyboard on a touch device, since
 * the page carries its own keypad. A physical keyboard still works.
 */
export function suppressSystemKeyboard(input: HTMLInputElement): void {
  if (window.matchMedia('(pointer: coarse)').matches) input.inputMode = 'none';
}
