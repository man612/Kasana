<script setup lang="ts">
import UiButton from '@/components/lib/ui/button/Button.vue';
import * as Popover from '@/components/lib/ui/popover';
import { useLogout } from '@/composable/actions/logout';
import { cn } from '@/lib/utils';
import { ROUTES_NAMES } from '@/routes/constants';
import { useUserStore } from '@/stores';
import { BookOpenIcon, ChevronUpIcon, FileTextIcon, LogOutIcon, UserIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

defineProps<{ compact?: boolean; elevated?: boolean }>();
const { t } = useI18n();
const { user } = storeToRefs(useUserStore());
const logoutHandler = useLogout();
const isOpen = ref(false);
</script>

<template>
  <div :class="cn('flex items-center gap-1', elevated && 'bg-card border-border rounded-md border pr-1.5')">
    <Popover.Popover v-model:open="isOpen">
      <Popover.PopoverTrigger as-child>
        <button
          :class="cn('hover:bg-accent flex items-center rounded-md transition-colors',
            compact ? 'size-10 justify-center' : 'min-w-0 flex-1 gap-2 px-3 py-2 text-left')"
          :aria-label="compact ? (user?.email ?? undefined) : undefined"
        >
          <div class="bg-primary/20 text-primary-text flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            {{ user?.email?.charAt(0).toUpperCase() || '?' }}
          </div>
          <template v-if="!compact">
            <span class="text-muted-foreground min-w-0 flex-1 truncate text-sm">
              {{ user?.email || 'Pengguna' }}
            </span>
            <ChevronUpIcon :class="['text-muted-foreground size-4 shrink-0 transition-transform',
              isOpen && 'rotate-180']" />
          </template>
        </button>
      </Popover.PopoverTrigger>
      <Popover.PopoverContent :side="compact ? 'right' : 'top'" :align="compact ? 'end' : 'start'" class="w-56 p-1">
        <router-link :to="{ name: ROUTES_NAMES.settingsSecurity }" @click="isOpen = false">
          <UiButton variant="ghost" class="w-full justify-start gap-2 px-3" size="default">
            <UserIcon class="size-4" />
            <span>{{ t('navigation.accountDetails') }}</span>
          </UiButton>
        </router-link>
        <a href="/panduan.html" target="_blank" rel="noopener noreferrer" @click="isOpen = false">
          <UiButton variant="ghost" class="w-full justify-start gap-2 px-3" size="default">
            <BookOpenIcon class="size-4" /><span>Panduan penggunaan</span>
          </UiButton>
        </a>
        <a href="/legal.html" target="_blank" rel="noopener noreferrer" @click="isOpen = false">
          <UiButton variant="ghost" class="w-full justify-start gap-2 px-3" size="default">
            <FileTextIcon class="size-4" /><span>Lisensi & kode sumber</span>
          </UiButton>
        </a>
        <div class="bg-border/50 my-1 h-px" />
        <UiButton variant="ghost-destructive" class="w-full justify-start gap-2 px-3" size="default"
          @click="logoutHandler(); isOpen = false">
          <LogOutIcon class="size-4" /><span>{{ t('navigation.logout') }}</span>
        </UiButton>
      </Popover.PopoverContent>
    </Popover.Popover>
    <slot name="trailing" />
  </div>
</template>
