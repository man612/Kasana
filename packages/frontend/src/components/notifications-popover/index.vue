<script setup lang="ts">
import type { NotificationStruct } from '@/api/notifications';
import Button from '@/components/lib/ui/button/Button.vue';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/lib/ui/popover';
import {
  useDismissNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationsCount,
} from '@/composable/data-queries/notifications';
import { NOTIFICATION_STATUSES } from '@bt/shared/types';
import { BellIcon, BellOffIcon, Loader2Icon, XIcon } from '@lucide/vue';
import { ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { buildNotificationRoute } from './build-notification-route';
import NotificationItem from './notification-item.vue';

withDefaults(defineProps<{ sidebar?: boolean }>(), { sidebar: false });

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const isOpen = ref(false);
const titleId = useId();
const heading = ref<HTMLElement | null>(null);
watch(
  () => route.fullPath,
  () => {
    isOpen.value = false;
  },
);

const { data: notifications, isPending } = useNotifications({ enabled: isOpen });
const { data: unreadCount } = useUnreadNotificationsCount();

const markAsReadMutation = useMarkNotificationAsRead();
const markAllAsReadMutation = useMarkAllNotificationsAsRead();
const dismissMutation = useDismissNotification();

const handleNotificationClick = (notification: NotificationStruct) => {
  if (notification.status === NOTIFICATION_STATUSES.unread) {
    markAsReadMutation.mutate({ id: notification.id });
  }

  const route = buildNotificationRoute(notification);
  if (!route) return;

  isOpen.value = false;
  if (route.kind === 'spa') {
    router.push(route.to);
  } else {
    window.open(route.href, '_blank', 'noopener');
  }
};

const handleMarkAllAsRead = () => {
  markAllAsReadMutation.mutate();
};

const handleDismiss = (id: string) => {
  dismissMutation.mutate({ id });
};
</script>

<template>
  <Popover v-model:open="isOpen" modal>
    <PopoverTrigger as-child>
      <!-- Sidebar mode: full-width button with label -->
      <template v-if="sidebar">
        <button
          class="hover:bg-accent hover:text-accent-foreground text-muted-foreground relative inline-flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[background-color,color] duration-200"
          :aria-expanded="isOpen"
          :aria-label="t('notifications.title')"
        >
          <BellIcon
            class="size-4 shrink-0 transition-transform duration-250 ease-out motion-reduce:transition-none"
            :class="isOpen && 'scale-110 -rotate-16'"
          />
          <span>{{ t('notifications.title') }}</span>
          <span
            v-if="unreadCount && unreadCount > 0"
            class="bg-primary ml-auto flex size-5 items-center justify-center rounded-full text-xs text-white"
          >
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        </button>
      </template>
      <!-- Header mode: icon-only button -->
      <template v-else>
        <Button
          variant="secondary"
          size="icon"
          class="relative transition-[background-color,box-shadow] duration-200"
          :class="isOpen && 'bg-primary/10 ring-primary/30 ring-1'"
          :aria-expanded="isOpen"
          :aria-label="t('notifications.title')"
        >
          <BellIcon
            class="size-5 transition-transform duration-250 ease-out motion-reduce:transition-none"
            :class="isOpen && 'scale-110 -rotate-16'"
          />
          <span
            v-if="unreadCount && unreadCount > 0"
            class="bg-primary absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-xs text-white"
          >
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        </Button>
      </template>
    </PopoverTrigger>
    <PopoverContent
      dim-backdrop
      lock-side
      :align="sidebar ? 'start' : 'end'"
      :side="sidebar ? 'top' : 'bottom'"
      :aria-labelledby="titleId"
      class="w-[min(24rem,calc(100vw-1.5rem))] rounded-xl p-3"
      @open-auto-focus.prevent="heading?.focus({ preventScroll: true })"
    >
      <div class="flex items-center justify-between gap-2">
        <h2 :id="titleId" ref="heading" tabindex="-1" class="text-base font-semibold outline-none">
          {{ t('notifications.title') }}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-11"
          :aria-label="t('common.ui.close')"
          @click="isOpen = false"
        >
          <XIcon class="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div v-if="unreadCount && unreadCount > 0" class="flex justify-end border-b pb-2">
        <Button
          v-if="unreadCount && unreadCount > 0"
          variant="ghost"
          size="sm"
          class="h-auto px-2 py-1 text-xs"
          :disabled="markAllAsReadMutation.isPending.value"
          @click="handleMarkAllAsRead"
        >
          {{ $t('notifications.markAllAsRead') }}
        </Button>
      </div>

      <div v-if="isPending" class="flex items-center justify-center py-8">
        <Loader2Icon class="text-muted-foreground size-6 animate-spin" />
      </div>

      <div v-else-if="!notifications?.length" class="py-8 text-center">
        <BellOffIcon class="text-muted-foreground mx-auto mb-2 size-10 opacity-50" />
        <p class="text-muted-foreground text-sm">{{ $t('notifications.empty') }}</p>
      </div>

      <div v-else class="divide-border">
        <div class="divide-border divide-y">
          <NotificationItem
            v-for="notification in notifications"
            :key="notification.id"
            :notification="notification"
            @click="handleNotificationClick"
            @dismiss="handleDismiss"
          />
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
