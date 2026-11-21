<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { ROUTES_NAMES } from '@/routes/constants';
import { useAuthStore } from '@/stores/auth';
import { apiAvailability } from '@/lib/api-availability';
import { useQueryClient } from '@tanstack/vue-query';
import { useOnline } from '@vueuse/core';
import { WifiOffIcon } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

const online = useOnline();
const issue = computed(() =>
  online.value ? (apiAvailability.value === 'offline' ? 'unreachable' : apiAvailability.value) : 'offline',
);
const queryClient = useQueryClient();
const authStore = useAuthStore();
const router = useRouter();
const retrying = ref(false);
const retry = async () => {
  retrying.value = true;
  try {
    if (!authStore.isLoggedIn) {
      if (await authStore.validateSession()) await router.replace({ name: ROUTES_NAMES.home });
    } else {
      await queryClient.refetchQueries({ type: 'active' });
    }
  } finally {
    retrying.value = false;
  }
};
</script>

<template>
  <Transition name="lajur-info-reveal">
    <aside
      v-if="issue"
      class="border-border bg-dialog fixed right-3 bottom-[max(1rem,calc(var(--bottom-navbar-height,0px)+.5rem))] left-3 z-(--z-navbar) mx-auto flex max-w-md items-center gap-2 rounded-lg border p-2.5 shadow-md"
    >
      <WifiOffIcon class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <div class="min-w-0 flex-1 text-xs" role="status">
        <p>{{ $t(`common.connection.${issue}`) }}</p>
        <p class="text-muted-foreground">{{ $t('common.connection.cachedData') }}</p>
      </div>
      <Button v-if="online" type="button" size="sm" variant="outline" :loading="retrying" @click="retry">
        {{ $t('common.actions.retry') }}
      </Button>
    </aside>
  </Transition>
</template>
