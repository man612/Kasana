import type { Directive } from 'vue';

// Preserve focus trapping, native form controls, and independent scrolling.
// CSS interpolate-size only handles length-to-auto, not changes between two
// intrinsic heights; observe the actual outer dialog height instead.
const observers = new WeakMap<HTMLElement, () => void>();
const DURATION_MS = 190;
const MIN_CHANGE_PX = 4;
const MAX_CHANGE_PX = 280;

export function observeDialogHeight(element: HTMLElement): () => void {
  if (typeof ResizeObserver === 'undefined' || typeof element.animate !== 'function') return () => {};

  let previousHeight: number | undefined;
  let animation: Animation | null = null;
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry || animation) return;

    const height = entry.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height;
    if (!Number.isFinite(height) || height <= 0) return;

    const startHeight = previousHeight;
    previousHeight = height;
    if (startHeight === undefined || element.dataset.state !== 'open') return;
    const difference = Math.abs(height - startHeight);
    if (difference < MIN_CHANGE_PX || difference > MAX_CHANGE_PX) return;
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
        previousHeight = element.getBoundingClientRect().height;
      });
  });
  observer.observe(element, { box: 'border-box' });
  return () => {
    observer.disconnect();
    animation?.cancel();
    animation = null;
  };
}

export const vAnimateDialogHeight: Directive<HTMLElement> = {
  mounted(element) {
    observers.set(element, observeDialogHeight(element));
  },
  unmounted(element) {
    observers.get(element)?.();
    observers.delete(element);
  },
};
