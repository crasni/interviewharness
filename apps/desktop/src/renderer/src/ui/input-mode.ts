/**
 * Remembers whether the candidate last used the mouse or moved focus with the keyboard, on <html data-input>.
 * Chromium's own :focus-visible guess shows the focus ring on a clicked button again after switching
 * windows and back; the styles hide rings and focus tooltips while the mouse was last used.
 */
const navigationKeys = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function trackInputMode() {
  const root = document.documentElement;
  root.dataset.input = 'pointer';
  window.addEventListener('pointerdown', () => (root.dataset.input = 'pointer'), true);
  window.addEventListener(
    'keydown',
    (event) => {
      if (navigationKeys.has(event.key)) root.dataset.input = 'keyboard';
    },
    true,
  );
}
