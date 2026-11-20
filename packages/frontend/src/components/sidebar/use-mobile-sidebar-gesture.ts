import { useEventListener, usePreferredReducedMotion } from '@vueuse/core';
import { nextTick, onScopeDispose, ref, watch, type Ref } from 'vue';

const EDGE_START = 12;
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
    claimed: boolean;
  } | null = null;
  let position = 0;
  let settling = false;
  let frame = 0;
  let drawerElement: HTMLElement | null;
  let overlayElement: HTMLElement | null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const panel = () => {
    if (!drawerElement?.isConnected) drawerElement = document.querySelector('[data-mobile-sidebar]');
    return drawerElement;
  };
  const backdrop = () => {
    if (!overlayElement?.isConnected) overlayElement = document.querySelector('.lajur-mobile-sidebar-overlay');
    return overlayElement;
  };

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
    stopTracking();
    cancelAnimationFrame(frame);
    frame = 0;
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
    cancelAnimationFrame(frame);
    frame = 0;
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
      const startedOnPanel = Boolean(target.closest('[data-mobile-sidebar]'));
      const canTakeOver = settling && point.clientX >= EDGE_START && point.clientX <= EDGE_END;
      if ((!startedOnPanel && !canTakeOver) || target.closest('input, textarea, [data-no-nav-swipe]')) return;
    } else {
      if (point.clientX < EDGE_START || point.clientX > EDGE_END) return;
      if (target.closest('input, select, textarea, nav, svg, canvas, [role="slider"], [data-no-nav-swipe]')) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
    }
    const drawer = panel();
    const width = drawer?.offsetWidth || Math.min(window.innerWidth * 0.82, MAX_DRAWER_WIDTH);
    touch = {
      id: point.identifier,
      x: point.clientX,
      y: point.clientY,
      wasOpen: open.value,
      width,
      originPosition: open.value ? 0 : -width,
      claimed: false,
      lastX: point.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
    window.addEventListener('touchmove', move, { capture: true, passive: false });
  };

  const move = (event: TouchEvent) => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0]!;
    if (point.identifier !== touch.id) return;
    const movement = point.clientX - touch.x;
    if (!touch.claimed) {
      const vertical = Math.abs(point.clientY - touch.y);
      if (Math.max(Math.abs(movement), vertical) < DRAG_SLOP) return;
      if (
        !event.cancelable ||
        vertical * 1.35 >= Math.abs(movement) ||
        (!settling && (touch.wasOpen ? movement > 0 : movement < 0))
      ) {
        stopTracking();
        return;
      }
      if (settling) {
        // Take over at the rendered offset only after a horizontal gesture has won.
        touch.originPosition = panel()?.getBoundingClientRect().left ?? position;
        clearTimeout(settleTimer);
        settling = false;
      }
      touch.claimed = true;
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
    position = Math.min(0, Math.max(-touch.width, touch.originPosition + movement));
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (touch?.claimed) setPosition({ x: position, width: touch.width });
      });
    }
  };

  const end = (event: TouchEvent) => {
    const current = touch;
    if (!current || !Array.from(event.changedTouches).some((point) => point.identifier === current.id)) return;
    stopTracking();
    if (!current.claimed) return;

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
  const stopTracking = () => {
    touch = null;
    window.removeEventListener('touchmove', move, true);
  };
  useEventListener(window, ['touchend', 'touchcancel'], end, { capture: true, passive: true });
  watch(open, (value) => {
    if (!value && !settling) void nextTick(clear);
  });
  onScopeDispose(clear);

  return { gesture, skipOpenAnimation };
}
