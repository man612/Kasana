<script setup lang="ts">
defineProps<{ open: boolean; anchor?: HTMLElement | null }>();
</script>

<template>
  <Transition name="lajur-menu-scrim">
    <div
      v-if="open && !anchor?.closest('[role=dialog], [role=alertdialog]')"
      class="lajur-scrim-menu lajur-scrim-blur pointer-events-none fixed inset-0 z-(--z-dialog)"
      aria-hidden="true"
    />
  </Transition>
</template>
