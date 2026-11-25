export function revealInScrollViewport({
  target,
  viewport,
  topInset = 0,
}: {
  target: Element;
  viewport: HTMLElement;
  topInset?: number;
}) {
  const padding = 8;
  const view = viewport.getBoundingClientRect();
  const bounds = target.getBoundingClientRect();
  const top = view.top + topInset + padding;
  const bottom = view.bottom - padding;
  const above = bounds.top - top;
  const below = bounds.bottom - bottom;
  const offset = bounds.height > bottom - top ? above : above < 0 ? above : Math.max(0, below);
  if (Math.abs(offset) <= 1) return;
  viewport.scrollBy({
    top: offset,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
