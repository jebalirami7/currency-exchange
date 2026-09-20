/**
 * Registers the worker that lets the app open without a network, and tells it
 * what this visit loaded.
 *
 * That last part matters: the worker takes control only after the page is
 * already up, so nothing the first visit fetched went through it. Handing
 * over the list closes the gap, instead of leaving the app offline-capable
 * only from the second visit.
 *
 * Failure is not worth reporting. A page that cannot register a worker still
 * works; it just needs a connection to start.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void warm();
  });
}

async function warm(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
    );
    await navigator.serviceWorker.ready;

    registration.active?.postMessage({ type: 'warm', urls: loadedUrls() });
  } catch {
    // No worker, no offline start. The app is otherwise unaffected.
  }
}

/** This page and every file it pulled in to render. */
function loadedUrls(): string[] {
  const resources = performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.startsWith('http'));

  return [...new Set([window.location.href, ...resources])];
}
