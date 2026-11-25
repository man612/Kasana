import type { Ref } from 'vue';

const HORIZONTAL_GESTURE_THRESHOLD = 48;
const INTERACTIVE_SURFACES =
  'button, a, input, textarea, select, nav, [role="tablist"], [role="slider"], [role="dialog"], [data-no-nav-swipe], svg, canvas';

export function useHorizontalTabSwipe({
  current,
  values,
  select,
}: {
  current: Readonly<Ref<string>>;
  values: () => string[];
  select: (value: string) => void;
}) {
  let start: { x: number; y: number; id: number } | undefined;
  const cancel = () => {
    start = undefined;
  };
  const begin = (event: TouchEvent) => {
    cancel();
    const target = event.target;
    if (!(target instanceof Element) || event.touches.length !== 1) return;
    if (target.closest('[data-tab-swipe]') !== event.currentTarget || target.closest(INTERACTIVE_SURFACES)) return;
    const touch = event.touches[0]!;
    if (touch.clientX < 20 || touch.clientX > window.innerWidth - 20) return;
    start = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
  };
  const end = (event: TouchEvent) => {
    const previous = start;
    cancel();
    if (!previous || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0]!;
    if (touch.identifier !== previous.id || event.touches.length) return;
    const dx = touch.clientX - previous.x;
    const dy = touch.clientY - previous.y;
    if (Math.abs(dx) < HORIZONTAL_GESTURE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const tabs = values();
    const index = tabs.indexOf(current.value);
    const next = tabs[index + (dx < 0 ? 1 : -1)];
    if (index >= 0 && next) select(next);
  };
  return { begin, end, cancel };
}
