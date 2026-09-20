/**
 * Looks up an element that the markup guarantees exists, and fails loudly if
 * it does not — a missing node is a template bug, not a runtime condition.
 */
export function requireElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}
