<script lang="ts" setup>
import { DrawerHandle } from 'vaul-vue';
</script>

<template>
  <DrawerHandle class="mx-auto mt-2 flex h-7 w-20 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
    <span aria-hidden="true" class="bg-muted-foreground/40 h-1.5 w-12 rounded-full" />
  </DrawerHandle>
</template>
