<script lang="ts">
import { shallowRef } from 'vue';

const layers = shallowRef<symbol[]>([]);
</script>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch, watchEffect } from 'vue';

const props = defineProps<{
  open: boolean;
  appBlocking?: boolean;
  keepClosedSlot?: boolean;
}>();

const layer = ref<HTMLElement>();
const id = Symbol();
const order = computed(() => layers.value.indexOf(id));

const unregister = () => {
  if (layers.value.includes(id)) layers.value = layers.value.filter((entry) => entry !== id);
};

watch(
  () => props.open,
  (open) => {
    if (open) layers.value = [...layers.value.filter((entry) => entry !== id), id];
  },
  { immediate: true, flush: 'sync' },
);

// Keep an exiting backdrop in its original stack position until its own primitive finishes.
watchEffect(
  (onCleanup) => {
    const element = layer.value;
    if (props.open || order.value < 0 || !element) return;

    const checkPresence = () => {
      if (!props.open && !element.querySelector('[data-dismissable-layer], [data-lajur-backdrop]')) unregister();
    };
    const observer = new MutationObserver(checkPresence);
    observer.observe(element, { childList: true, subtree: true });
    onCleanup(() => observer.disconnect());
    checkPresence();
  },
  { flush: 'post' },
);

const blockLeavingInput = (event: Event) => {
  if (props.open) return;
  event.preventDefault();
  event.stopPropagation();
};

onScopeDispose(unregister);
</script>

<template>
  <div
    v-if="order >= 0"
    ref="layer"
    class="pointer-events-none fixed inset-0"
    :style="{
      zIndex: appBlocking
        ? 'var(--z-app-lock)'
        : `calc(max(var(--z-over-dialog), var(--z-notifications)) + ${order + 1})`,
    }"
    :data-lajur-overlay-layer="open ? 'open' : 'closed'"
    :data-lajur-nested-overlay="order > 0 ? '' : undefined"
    @pointerdown.capture="blockLeavingInput"
    @pointerup.capture="blockLeavingInput"
    @click.capture="blockLeavingInput"
  >
    <slot />
  </div>
  <slot v-else-if="keepClosedSlot" />
</template>
