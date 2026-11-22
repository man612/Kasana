import type { Directive } from 'vue';

// Preserve focus trapping, native form controls, and independent scrolling.
// CSS interpolate-size only handles length-to-auto, not changes between two
// intrinsic heights; observe the actual outer dialog height instead.
const observers = new WeakMap<HTMLElement, () => void>();
const DURATION_MS = 190;
const MIN_CHANGE_PX = 4;

export function observeDialogHeight(element: HTMLElement): () => void {
  if (typeof ResizeObserver === 'undefined' || typeof element.animate !== 'function') return () => {};

  let previousHeight: number | undefined;
  let wasResizingForKeyboard = element.hasAttribute('data-keyboard-resize');
  let animation: Animation | null = null;
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const resizingForKeyboard = element.hasAttribute('data-keyboard-resize');
    const keyboardChanged = wasResizingForKeyboard !== resizingForKeyboard;
    wasResizingForKeyboard = resizingForKeyboard;

    if (animation) {
      if (!resizingForKeyboard && !keyboardChanged) return;
      animation.cancel();
      animation = null;
    }

    const height = entry.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height;
    if (!Number.isFinite(height) || height <= 0) return;

    const startHeight = previousHeight;
    previousHeight = height;
    if (startHeight === undefined || resizingForKeyboard || keyboardChanged || element.dataset.state !== 'open') return;
    // The entrance keyframe and the resize animation both affect the rendered
    // surface. Establish its natural baseline until the entrance has finished.
    if (element.getAnimations?.().some((effect) => 'animationName' in effect && effect.playState === 'running')) return;
    const difference = Math.abs(height - startHeight);
    if (difference < MIN_CHANGE_PX) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // The content's scroll container handles tall dialogs; never animate at
    // the viewport size cap, where doing so would obscure footer actions.
    const maxHeight = Number.parseFloat(getComputedStyle(element).maxHeight);
    if (Number.isFinite(maxHeight) && height >= maxHeight - 2) return;

    const next = element.animate([{ height: `${startHeight}px` }, { height: `${height}px` }], {
      duration: DURATION_MS,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    animation = next;
    void next.finished
      .catch(() => undefined)
      .then(() => {
        if (animation !== next) return;
        animation = null;
        // Keep the completed target as the baseline. ResizeObserver can then
        // pick up content that changed during the animation on its next measurement.
        previousHeight = height;
      });
  });
  observer.observe(element, { box: 'border-box' });
  return () => {
    observer.disconnect();
    animation?.cancel();
    animation = null;
  };
}

export const vAnimateDialogHeight: Directive<HTMLElement, boolean | undefined> = {
  mounted(element, { value }) {
    if (value === false) return;
    observers.set(element, observeDialogHeight(element));
  },
  unmounted(element) {
    observers.get(element)?.();
    observers.delete(element);
  },
};
