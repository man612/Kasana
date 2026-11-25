<script setup lang="ts">
import { getSecurityLogoUrl, type SecurityLogoSource } from '@/common/utils/security-logo-url';
import AsyncLogo from '@/components/common/async-logo.vue';
import { computed } from 'vue';

const props = defineProps<{ security: SecurityLogoSource }>();

const url = computed(() => getSecurityLogoUrl(props.security));
</script>

<template>
  <!-- Ring/circle only when there's an actual logo to frame. Without a URL,
       AsyncLogo also drops its bg-white, so the slot renders as empty space. -->
  <AsyncLogo v-if="url" :url="url" class="ring-border/40 rounded-full ring-1" />
  <span
    v-else
    class="bg-primary/10 text-primary-text flex size-6 shrink-0 items-center justify-center rounded-md text-[0.625rem] font-semibold"
    aria-hidden="true"
    >{{ security.symbol?.slice(0, 2).toUpperCase() ?? '—' }}</span
  >
</template>
