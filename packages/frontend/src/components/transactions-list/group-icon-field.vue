<script setup lang="ts">
import IconPickerDropdown from '@/components/common/icons/icon-picker-dropdown.vue';
import { Button } from '@/components/lib/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/lib/ui/popover';
import { PencilIcon } from '@lucide/vue';
import { ref } from 'vue';

import GroupIcon from './group-icon.vue';

const icon = defineModel<string>({ required: true });
const open = ref(false);
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        class="relative size-11 shrink-0"
        :aria-label="$t('transactions.transactionGroups.icon.label')"
      >
        <GroupIcon :icon="icon" />
        <PencilIcon class="text-muted-foreground bg-background absolute right-0.5 bottom-0.5 size-3 rounded-sm" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[min(24rem,calc(100vw-1.5rem))] p-2" align="end" side="bottom">
      <IconPickerDropdown v-model="icon" @close="open = false" />
    </PopoverContent>
  </Popover>
</template>
