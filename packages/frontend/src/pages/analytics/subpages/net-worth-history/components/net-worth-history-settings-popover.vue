<template>
  <DesktopOnlyTooltip :content="$t('netWorthHistory.settings.title')">
    <span class="inline-flex">
      <Popover v-model:open="isOpen">
        <PopoverTrigger as-child>
          <Button size="icon" variant="secondary" :aria-label="$t('netWorthHistory.settings.title')">
            <SettingsIcon
              class="size-4 transition-transform duration-250 ease-out motion-reduce:transition-none"
              :class="isOpen && 'rotate-90'"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent dim-backdrop class="w-72 max-w-[calc(100vw-2rem)] p-0" align="end">
          <header class="border-b px-3 py-2 text-sm font-medium">{{ $t('netWorthHistory.settings.title') }}</header>

          <div class="p-2">
            <div class="flex items-center justify-between gap-3 rounded-md px-2 py-2">
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ $t('netWorthHistory.settings.zoomLiabilities') }}</span>
                <span class="text-muted-foreground text-xs">
                  {{ $t('netWorthHistory.settings.zoomLiabilitiesHint') }}
                </span>
              </div>
              <Switch
                :model-value="zoomLiabilitiesScale"
                @update:model-value="(value) => emit('update:zoomLiabilitiesScale', !!value)"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  </DesktopOnlyTooltip>
</template>

<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/lib/ui/popover';
import { Switch } from '@/components/lib/ui/switch';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { SettingsIcon } from '@lucide/vue';
import { ref } from 'vue';

defineProps<{ zoomLiabilitiesScale: boolean }>();
const isOpen = ref(false);

const emit = defineEmits<{ 'update:zoomLiabilitiesScale': [value: boolean] }>();
</script>
