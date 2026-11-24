<script setup lang="ts">
defineProps<{ open: boolean }>();
</script>

<template>
  <div
    class="grid transition-[grid-template-rows,opacity] duration-(--kasana-motion-normal) ease-(--kasana-motion-ease) motion-reduce:transition-none"
    :class="open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'"
    :inert="!open"
  >
    <div class="min-h-0 [overflow-x:visible] [overflow-y:clip]">
      <slot />
    </div>
  </div>
</template>
