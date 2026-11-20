import { useEventListener, usePreferredReducedMotion } from '@vueuse/core';
import { nextTick, onScopeDispose, ref, watch, type Ref } from 'vue';

const EDGE_START = 22;
const EDGE_END = 62;
const DRAG_SLOP = 9;
const SETTLE_MS = 220;
const MAX_DRAWER_WIDTH = 352;
const FLICK_SPEED = 0.45;

export function shouldOpenMobileSidebar({
  progress,
  velocity,
  wasOpen,
}: {
  progress: number;
  velocity: number;
  wasOpen: boolean;
}) {
  if (Math.abs(velocity) >= FLICK_SPEED) return velocity > 0;
  return wasOpen ? progress > 0.62 : progress >= 0.38;
}

export function useMobileSidebarGesture({ enabled, open }: { enabled: Ref<boolean>; open: Ref<boolean> }) {
  const gesture = ref(false);
  const skipOpenAnimation = ref(false);
  const reducedMotion = usePreferredReducedMotion();
  let touch: {
    id: number;
    x: number;
    y: number;
    wasOpen: boolean;
    width: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    /** Drawer offset when this touch began, including interrupted settle motion. */
    originPosition: number;
  } | null = null;
  let position = 0;
  let settling = false;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const panel = () => document.querySelector<HTMLElement>('[data-mobile-sidebar]');
  const backdrop = () => document.querySelector<HTMLElement>('.lajur-mobile-sidebar-overlay');

  const setPosition = ({ x, width, duration = 0 }: { x: number; width: number; duration?: number }) => {
    position = Math.min(0, Math.max(-width, x));
    const transition = (property: string) =>
      duration ? `${property} ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none';
    const drawer = panel();
    const overlay = backdrop();
    if (drawer) {
      drawer.style.transition = transition('transform');
      drawer.style.transform = `translate3d(${position}px, 0, 0)`;
    }
    if (overlay) {
      overlay.style.transition = transition('opacity');
      overlay.style.opacity = String(1 + position / width);
    }
  };

  const clear = () => {
    clearTimeout(settleTimer);
    touch = null;
    settling = false;
    gesture.value = false;
    if (!open.value) skipOpenAnimation.value = false;
    panel()?.style.removeProperty('transform');
    panel()?.style.removeProperty('transition');
    backdrop()?.style.removeProperty('opacity');
    backdrop()?.style.removeProperty('transition');
  };

  const settle = async (stayOpen: boolean, width: number) => {
    settling = true;
    await nextTick();
    if (!settling) return;
    const duration = reducedMotion.value === 'reduce' ? 0 : SETTLE_MS;
    setPosition({ x: stayOpen ? 0 : -width, width, duration });
    settleTimer = setTimeout(async () => {
      if (!stayOpen) {
        open.value = false;
        // Let the dialog leave while its default CSS animation is still suppressed.
        await nextTick();
      }
      clear();
    }, duration);
  };

  const start = (event: TouchEvent) => {
    if (!enabled.value || touch || event.touches.length !== 1) return;
    const point = event.touches[0]!;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (open.value) {
      if (!target.closest('[data-mobile-sidebar]') || target.closest('input, textarea, [data-no-nav-swipe]')) return;
    } else {
      if (point.clientX < EDGE_START || point.clientX > EDGE_END) return;
      if (target.closest('input, select, textarea, nav, svg, canvas, [role="slider"], [data-no-nav-swipe]')) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
    }
    const drawer = panel();
    const width = drawer?.offsetWidth || Math.min(window.innerWidth * 0.82, MAX_DRAWER_WIDTH);
    // A fast reverse swipe must take over an in-flight settle. Otherwise the
    // user can touch the visible drawer while settling=true and nothing happens.
    // Freeze at the *rendered* offset, not the transition target, so the panel
    // follows the next finger without snapping to its final position.
    const originPosition = open.value ? (settling ? (drawer?.getBoundingClientRect().left ?? position) : 0) : -width;
    if (settling) {
      clearTimeout(settleTimer);
      settling = false;
      setPosition({ x: originPosition, width });
    }
    touch = {
      id: point.identifier,
      x: point.clientX,
      y: point.clientY,
      wasOpen: open.value,
      width,
      originPosition,
      lastX: point.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
  };

  const move = (event: TouchEvent) => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0]!;
    if (point.identifier !== touch.id) return;
    const movement = point.clientX - touch.x;
    if (!gesture.value) {
      const vertical = Math.abs(point.clientY - touch.y);
      if (Math.max(Math.abs(movement), vertical) < DRAG_SLOP) return;
      if (!event.cancelable || vertical * 1.35 >= Math.abs(movement) || (touch.wasOpen ? movement > 0 : movement < 0)) {
        touch = null;
        return;
      }
      gesture.value = true;
      skipOpenAnimation.value = true;
      open.value = true;
      void nextTick(() => {
        if (touch && gesture.value && !settling) setPosition({ x: position, width: touch.width });
      });
    }

    if (event.cancelable) event.preventDefault();
    const elapsed = event.timeStamp - touch.lastTime;
    if (elapsed > 0) touch.velocity = (point.clientX - touch.lastX) / elapsed;
    touch.lastX = point.clientX;
    touch.lastTime = event.timeStamp;
    setPosition({ x: touch.originPosition + movement, width: touch.width });
  };

  const end = (event: TouchEvent) => {
    const current = touch;
    if (!current || !Array.from(event.changedTouches).some((point) => point.identifier === current.id)) return;
    touch = null;
    if (!gesture.value) return;

    const stayOpen =
      event.type === 'touchcancel'
        ? current.wasOpen
        : shouldOpenMobileSidebar({
            wasOpen: current.wasOpen,
            progress: 1 + position / current.width,
            velocity: event.timeStamp - current.lastTime <= 90 ? current.velocity : 0,
          });
    void settle(stayOpen, current.width);
  };

  useEventListener(window, 'touchstart', start, { capture: true, passive: true });
  useEventListener(window, 'touchmove', move, { capture: true, passive: false });
  useEventListener(window, ['touchend', 'touchcancel'], end, { capture: true, passive: true });
  watch(open, (value) => {
    if (!value && !settling) void nextTick(clear);
  });
  onScopeDispose(clear);

  return { gesture, skipOpenAnimation };
}
