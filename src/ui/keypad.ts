/** The key a press reports: a character to insert, or a deletion. */
export type KeypadKey = string | 'backspace';

export interface Keypad {
  readonly root: HTMLElement;
  /** Greys out the decimal key for a currency quoted in whole units. */
  setDecimalAllowed(allowed: boolean): void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * A keypad built into the page, so entering an amount never raises the
 * system keyboard over the board.
 */
export function createKeypad(press: (key: KeypadKey) => void): Keypad {
  const root = document.createElement('div');
  root.className = 'keypad';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Number pad');

  const decimal = key('.', '.', 'Decimal point');
  const keys = [
    ...DIGITS.map((digit) => key(digit, digit)),
    decimal,
    key('0', '0'),
    key('backspace', '⌫', 'Delete'),
  ];

  for (const button of keys) {
    // Taking the press on pointerdown, and refusing the default, keeps the
    // amount field focused — otherwise every key would steal the caret.
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (!button.disabled) press(button.value);
    });
    root.append(button);
  }

  return {
    root,
    setDecimalAllowed(allowed) {
      decimal.disabled = !allowed;
    },
  };
}

function key(value: string, label: string, description?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'keypad__key';
  button.value = value;
  button.textContent = label;
  if (description) button.setAttribute('aria-label', description);
  return button;
}
