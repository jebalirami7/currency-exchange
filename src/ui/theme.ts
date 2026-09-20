type Theme = 'light' | 'dark';

const STORAGE_KEY = 'currency-exchange:theme';

/**
 * Follows the device until the reader picks a side, then remembers the pick.
 *
 * No stored choice leaves `data-theme` off the document entirely, which is
 * what lets the stylesheet fall back to `prefers-color-scheme`.
 */
export function setupTheme(button: HTMLButtonElement): void {
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let choice = readStoredTheme();

  const current = (): Theme => choice ?? (system.matches ? 'dark' : 'light');

  const apply = (): void => {
    if (choice) {
      document.documentElement.dataset['theme'] = choice;
    } else {
      delete document.documentElement.dataset['theme'];
    }

    const theme = current();
    button.dataset['theme'] = theme;
    button.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme',
    );
  };

  system.addEventListener('change', () => {
    if (!choice) apply();
  });

  button.addEventListener('click', () => {
    choice = current() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Storage blocked; the choice simply lasts until the page is reloaded.
    }
    apply();
  });

  apply();
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}
