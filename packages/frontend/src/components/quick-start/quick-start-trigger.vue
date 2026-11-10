<script lang="ts" setup>
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/lib/ui/tooltip';
import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/stores/onboarding';
import { RocketIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const onboardingStore = useOnboardingStore();
const { progressPercentage, remainingCount, shouldShowTrigger, triggerPosition, hiddenUntil } =
  storeToRefs(onboardingStore);

const buttonRef = ref<HTMLButtonElement | null>(null);
const viewport = reactive({ width: 0, height: 0, zoom: 1, buttonWidth: 48, buttonHeight: 48 });
const EDGE_GAP = 12;
const TOP_INSET = 56;
const MOBILE_BOTTOM_INSET = 88;
const HOLD_MS = 420;
const MOVE_TOLERANCE = 9;

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

function safeBounds() {
  const minX = EDGE_GAP;
  const maxX = Math.max(minX, viewport.width - viewport.buttonWidth - EDGE_GAP);
  const minY = Math.min(TOP_INSET, Math.max(EDGE_GAP, viewport.height - viewport.buttonHeight));
  const maxY = Math.max(minY, viewport.height - viewport.buttonHeight - (isMobile() ? MOBILE_BOTTOM_INSET : EDGE_GAP));
  return { minX, maxX, minY, maxY };
}

function updateViewport() {
  if (typeof window === 'undefined') return;
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  const zoom = Number.parseFloat(window.getComputedStyle(document.documentElement).zoom);
  viewport.zoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const rect = buttonRef.value?.getBoundingClientRect();
  // The element may be v-if hidden; use the 48px unzoomed icon size as fallback.
  viewport.buttonWidth = rect?.width || 48 * viewport.zoom;
  viewport.buttonHeight = rect?.height || 48 * viewport.zoom;
}

const positionStyle = computed(() => {
  if (!triggerPosition.value || viewport.width === 0) return undefined;
  const { minX, maxX, minY, maxY } = safeBounds();
  const left = minX + triggerPosition.value.x * (maxX - minX);
  const top = minY + triggerPosition.value.y * (maxY - minY);
  return {
    left: `${left / viewport.zoom}px`,
    top: `${top / viewport.zoom}px`,
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
  };
});

let activePointer: number | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
const dragging = ref(false);
let suppressClick = false;
let originX = 0;
let originY = 0;
let grabOffsetX = 0;
let grabOffsetY = 0;

function clearLongPressTimer() {
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = null;
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || activePointer !== null) return;
  updateViewport();
  const rect = buttonRef.value?.getBoundingClientRect();
  if (!rect) return;
  activePointer = event.pointerId;
  originX = event.clientX;
  originY = event.clientY;
  grabOffsetX = event.clientX - rect.left;
  grabOffsetY = event.clientY - rect.top;
  dragging.value = false;
  suppressClick = false;
  // Capture keeps pointerup/cancel reachable even if the finger leaves the icon.
  buttonRef.value?.setPointerCapture?.(event.pointerId);
  longPressTimer = setTimeout(() => {
    if (activePointer === event.pointerId) dragging.value = true;
  }, HOLD_MS);
}

function onPointerMove(event: PointerEvent) {
  if (activePointer !== event.pointerId) return;
  if (!dragging.value) {
    if (Math.hypot(event.clientX - originX, event.clientY - originY) > MOVE_TOLERANCE) {
      clearLongPressTimer();
      suppressClick = true;
    }
    return;
  }
  event.preventDefault();
  const { minX, maxX, minY, maxY } = safeBounds();
  const x = Math.max(minX, Math.min(maxX, event.clientX - grabOffsetX));
  const y = Math.max(minY, Math.min(maxY, event.clientY - grabOffsetY));
  onboardingStore.setTriggerPosition({
    x: maxX === minX ? 0 : (x - minX) / (maxX - minX),
    y: maxY === minY ? 0 : (y - minY) / (maxY - minY),
  }, false);
}

function finishPointer(event: PointerEvent) {
  if (activePointer !== event.pointerId) return;
  if (dragging.value) {
    suppressClick = true;
    // Save only the final drop location, not every intermediate move.
    if (onboardingStore.triggerPosition) onboardingStore.setTriggerPosition(onboardingStore.triggerPosition);
  }
  clearLongPressTimer();
  dragging.value = false;
  activePointer = null;
  if (buttonRef.value?.hasPointerCapture?.(event.pointerId)) {
    buttonRef.value.releasePointerCapture(event.pointerId);
  }
}

function handleClick() {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  onboardingStore.openPanel();
}

function onKeydown(event: KeyboardEvent) {
  if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  updateViewport();
  const rect = buttonRef.value?.getBoundingClientRect();
  if (!rect) return;
  const { minX, maxX, minY, maxY } = safeBounds();
  const currentX = triggerPosition.value ? minX + triggerPosition.value.x * (maxX - minX) : rect.left;
  const currentY = triggerPosition.value ? minY + triggerPosition.value.y * (maxY - minY) : rect.top;
  const dx = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0;
  const dy = event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0;
  const x = Math.max(minX, Math.min(maxX, currentX + dx));
  const y = Math.max(minY, Math.min(maxY, currentY + dy));
  onboardingStore.setTriggerPosition({
    x: maxX === minX ? 0 : (x - minX) / (maxX - minX),
    y: maxY === minY ? 0 : (y - minY) / (maxY - minY),
  });
}

let wakeTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReappearance() {
  if (wakeTimer) clearTimeout(wakeTimer);
  const remaining = hiddenUntil.value - Date.now();
  if (remaining > 0) {
    wakeTimer = setTimeout(() => onboardingStore.showTriggerNow(), remaining);
  } else if (hiddenUntil.value > 0) {
    // Android may suspend timers when the tab is backgrounded: restore an
    // expired shortcut immediately on remount instead of leaving it hidden.
    onboardingStore.showTriggerNow();
  }
}
watch(hiddenUntil, scheduleReappearance);

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('resize', updateViewport);
  scheduleReappearance();
});
onUnmounted(() => {
  clearLongPressTimer();
  if (wakeTimer) clearTimeout(wakeTimer);
  window.removeEventListener('resize', updateViewport);
  window.visualViewport?.removeEventListener('resize', updateViewport);
});

// Circular onboarding progress.
const circumference = 2 * Math.PI * 15.9155;
const strokeDasharray = (progress: number) => {
  const filled = (progress / 100) * circumference;
  return `${filled} ${circumference}`;
};
</script>

<template>
  <TooltipProvider v-if="shouldShowTrigger">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          ref="buttonRef"
          type="button"
          :style="positionStyle"
          :aria-label="t('kasana.quickStart.triggerLabel', { count: remainingCount })"
          :class="
            cn(
              'fixed z-40 flex items-center justify-center touch-none select-none',
              'bg-background rounded-full border shadow-lg',
              'focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
              !dragging && 'transition-shadow duration-200 hover:shadow-xl',
              !triggerPosition && 'top-1/2 right-4 -translate-y-1/2 max-md:top-auto max-md:bottom-20 max-md:translate-y-0',
              dragging && 'ring-primary cursor-grabbing ring-2',
            )
          "
          @click="handleClick"
          @contextmenu.prevent
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="finishPointer"
          @pointercancel="finishPointer"
          @keydown="onKeydown"
        >
          <div class="relative size-12">
            <svg class="size-12 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle class="stroke-muted" stroke-width="3" fill="none" cx="18" cy="18" r="15.9155" />
              <circle
                class="stroke-primary transition-all duration-500 ease-out"
                stroke-width="3"
                stroke-linecap="round"
                fill="none"
                cx="18"
                cy="18"
                r="15.9155"
                :stroke-dasharray="strokeDasharray(progressPercentage)"
              />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <RocketIcon class="text-primary-text size-5" />
            </div>
          </div>

          <span
            v-if="remainingCount > 0"
            class="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-xs font-medium"
          >
            {{ remainingCount }}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>{{ t('kasana.quickStart.dragHint') }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
