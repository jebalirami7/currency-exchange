/**
 * Publishes the height left over when a system keyboard covers the page,
 * as `--viewport-height`.
 *
 * Only when one actually does. iOS Safari reports a visual viewport a little
 * shorter than the page even with no keyboard up — the toolbars sit inside
 * it — and pinning the layout to that would hold the keypad off the bottom of
 * the screen by exactly the height of the browser chrome. With the property
 * unset the stylesheet falls back to `100dvh`, which is the right answer
 * whenever nothing is covering the page.
 */

/** Below this much lost height, nothing is covering the page. */
const KEYBOARD_THRESHOLD_PX = 120;

export function trackViewportHeight(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const apply = (): void => {
    const covered = window.innerHeight - viewport.height > KEYBOARD_THRESHOLD_PX;

    if (covered) {
      document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);
    } else {
      document.documentElement.style.removeProperty('--viewport-height');
    }
  };

  viewport.addEventListener('resize', apply);
  viewport.addEventListener('scroll', apply);
  apply();
}
