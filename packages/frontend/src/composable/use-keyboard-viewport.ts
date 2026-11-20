import { useEventListener } from '@vueuse/core';
import { onScopeDispose, shallowRef, watch, type Ref } from 'vue';

/** Positions overlays against the visible area while a software keyboard resizes or pans it. */
export function useKeyboardViewport(enabled: Ref<boolean>) {
  const viewport = window.visualViewport;
  const bounds = shallowRef<{ top: number; height: number; bottomInset: number }>();
  let frame = 0;

  const update = () => {
    cancelAnimationFrame(frame);
    if (!enabled.value || !viewport) {
      bounds.value = undefined;
      return;
    }
    frame = requestAnimationFrame(() => {
      if (viewport.scale !== 1 || window.innerHeight - viewport.height < 100) {
        bounds.value = undefined;
        return;
      }
      bounds.value = {
        top: viewport.offsetTop,
        height: viewport.height,
        bottomInset: Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height),
      };
    });
  };

  useEventListener(viewport, 'resize', update, { passive: true });
  useEventListener(viewport, 'scroll', update, { passive: true });
  watch(enabled, update, { immediate: true });
  onScopeDispose(() => cancelAnimationFrame(frame));

  return bounds;
}
