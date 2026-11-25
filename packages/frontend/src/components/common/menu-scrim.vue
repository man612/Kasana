<script setup lang="ts">
withDefaults(defineProps<{ open: boolean; dim?: boolean }>(), { dim: true });
</script>

<template>
  <Transition name="lajur-menu-scrim" appear>
    <div
      v-if="open"
      class="pointer-events-auto fixed inset-0"
      :class="dim && 'lajur-scrim-menu lajur-scrim-blur'"
      data-lajur-backdrop
      aria-hidden="true"
      @pointerdown.left.prevent
      @click.prevent
    />
  </Transition>
</template>
