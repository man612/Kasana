<script setup lang="ts">
import { numberFormatLocale } from '@/js/helpers/formatters';
import { cn } from '@/lib/utils';
import { computed } from 'vue';

import { splitVehicleAmount } from './split-amount';

defineOptions({ inheritAttrs: false });
const props = defineProps<{ formatted: string; locale?: string }>();
const parts = computed(() =>
  splitVehicleAmount({ formatted: props.formatted, locale: props.locale ?? numberFormatLocale.value }),
);
</script>

<template>
  <span
    v-bind="{
      ...$attrs,
      class: cn(
        'inline-block max-w-full min-w-0 wrap-normal whitespace-normal [word-break:normal]',
        $attrs.class as string,
      ),
    }"
  >
    <span class="sr-only">{{ formatted }}</span>
    <span data-amount-visual aria-hidden="true"
      ><span v-if="parts.prefix">{{ parts.prefix }}</span
      ><wbr v-if="parts.prefix" /><template v-for="(group, index) in parts.groups" :key="index"
        ><wbr v-if="index" /><span data-amount-group class="inline-block whitespace-nowrap">{{ group }}</span></template
      ><wbr v-if="parts.suffix" /><span v-if="parts.suffix">{{ parts.suffix }}</span></span
    >
  </span>
</template>
