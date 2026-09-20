/**
 * Publishes the height actually visible to the user as `--viewport-height`.
 *
 * When the on-screen keyboard opens, iOS Safari shrinks the visual viewport
 * but leaves the layout viewport — and so `vh` and `dvh` — unchanged, so CSS
 * alone cannot tell that half the screen is now covered. `visualViewport`
 * reports it, and the layout anchors to the top of what is left.
 */
export function trackViewportHeight(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const apply = (): void => {
    document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);
  };

  viewport.addEventListener('resize', apply);
  viewport.addEventListener('scroll', apply);
  apply();
}
