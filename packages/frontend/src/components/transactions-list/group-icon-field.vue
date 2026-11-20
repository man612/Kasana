<script setup lang="ts">
import { DEFAULT_MONOGRAM_COLOR, type LogoSelection } from '@/components/common/logo-selection';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { PencilIcon } from '@lucide/vue';
import { computed, defineAsyncComponent, ref } from 'vue';

import GroupIcon from './group-icon.vue';

const LogoSearch = defineAsyncComponent(() => import('@/components/common/logo-search.vue'));

defineProps<{ name: string }>();
const icon = defineModel<string>({ required: true });
const color = defineModel<string | null>('color', { required: true });
const open = ref(false);

const selection = computed<LogoSelection | null>(() =>
  icon.value ? { kind: 'icon', icon: icon.value, color: color.value ?? DEFAULT_MONOGRAM_COLOR } : null,
);

const apply = (picked: LogoSelection) => {
  if (picked.kind !== 'icon') return;
  icon.value = picked.icon;
  color.value = picked.color;
  open.value = false;
};

const clear = () => {
  icon.value = '';
  color.value = null;
  open.value = false;
};
</script>

<template>
  <ResponsiveDialog v-model:open="open" raised mobile-presentation="center" dialog-content-class="max-w-md">
    <template #trigger>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="relative size-11 shrink-0"
        :aria-label="$t('transactions.transactionGroups.icon.label')"
      >
        <GroupIcon :icon="icon" :color="color" />
        <PencilIcon class="text-muted-foreground bg-background absolute right-0.5 bottom-0.5 size-3 rounded-sm" />
      </Button>
    </template>
    <template #title>{{ $t('transactions.transactionGroups.icon.label') }}</template>
    <LogoSearch
      :selection="selection"
      :name-for-search="name"
      :tabs="['icon']"
      :autofocus-icon-search="false"
      @select="apply"
    />
    <Button v-if="icon" type="button" variant="ghost-destructive" size="sm" class="self-end" @click="clear">
      {{ $t('common.iconPicker.clear') }}
    </Button>
  </ResponsiveDialog>
</template>
