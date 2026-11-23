<script setup lang="ts">
import { useDateLocale } from '@/composable/use-date-locale';
import { isSameDay, isWithinInterval, subDays } from 'date-fns';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatTransactionWeek, type TransactionTimeSection } from './time-sections';

const props = defineProps<{ section: TransactionTimeSection; today: Date }>();
const { format } = useDateLocale();
const { t } = useI18n();

const label = computed(() => {
  const { start, end } = props.section;
  if (+start !== +end) {
    const range = formatTransactionWeek({ start, end, format });
    return isWithinInterval(props.today, { start, end })
      ? t('transactions.timeGrouping.currentWeek', { range })
      : range;
  }
  if (isSameDay(start, props.today)) return t('transactions.timeGrouping.today');
  if (isSameDay(start, subDays(props.today, 1))) return t('transactions.timeGrouping.yesterday');
  return format(start, 'EEEE, d MMMM yyyy');
});
</script>

<template>
  <h3 class="bg-card text-muted-foreground flex min-h-9 items-center gap-2 px-2 py-1 text-xs font-semibold">
    <span>{{ label }}</span>
    <span class="bg-border/70 h-px flex-1" aria-hidden="true" />
  </h3>
</template>
