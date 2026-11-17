<template>
  <Popover.Popover :open="isOpen" @update:open="isOpen = $event">
    <Popover.PopoverTrigger as-child>
      <UiButton
        v-if="triggerVariant === 'labeled'"
        variant="outline"
        class="transition-[inline-size,background-color,color] duration-220 ease-out [interpolate-size:allow-keywords] motion-reduce:transition-none"
      >
        <ArrowUpDownIcon class="size-4" />
        <Transition name="kasana-form-copy" mode="out-in"
          ><span :key="sortKey" class="inline-block whitespace-nowrap">{{ currentLabel }}</span></Transition
        >
        <ChevronDownIcon
          class="size-4 opacity-60 transition-transform duration-200 motion-reduce:transition-none"
          :class="isOpen && 'rotate-180'"
        />
      </UiButton>
      <UiButton v-else variant="outline" size="icon" :aria-label="$t('accounts.sort.ariaLabel')">
        <ArrowUpDownIcon class="size-4" />
      </UiButton>
    </Popover.PopoverTrigger>

    <Popover.PopoverContent align="end" class="w-44 p-1">
      <UiButton
        v-for="opt in options"
        :key="opt.key"
        variant="ghost"
        size="sm"
        class="w-full justify-start gap-2 transition-colors duration-150"
        :aria-pressed="opt.key === sortKey"
        @click="selectSort(opt.key)"
      >
        <CheckIcon
          class="size-4 transition-[opacity,transform] duration-180 motion-reduce:transition-none"
          :class="opt.key === sortKey ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
        />
        {{ opt.label }}
      </UiButton>
    </Popover.PopoverContent>
  </Popover.Popover>
</template>

<script setup lang="ts">
import UiButton from '@/components/lib/ui/button/Button.vue';
import * as Popover from '@/components/lib/ui/popover';
import { ArrowUpDownIcon, CheckIcon, ChevronDownIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ACCOUNTS_SORT_KEYS, type AccountsSortKey } from '../accounts-sort';
import { useAccountsSort } from '../use-accounts-sort';

defineProps<{ triggerVariant: 'labeled' | 'icon' }>();

const { t } = useI18n();
const { sortKey, setSortKey } = useAccountsSort();

const isOpen = ref(false);

const sortLabels = computed<Record<AccountsSortKey, string>>(() => ({
  auto: t('accounts.sort.auto'),
  name: t('accounts.sort.name'),
  balance: t('accounts.sort.balance'),
}));

const options = computed(() => ACCOUNTS_SORT_KEYS.map((key) => ({ key, label: sortLabels.value[key] })));

const currentLabel = computed(() => sortLabels.value[sortKey.value]);

const selectSort = (key: AccountsSortKey) => {
  setSortKey(key);
  isOpen.value = false;
};
</script>
