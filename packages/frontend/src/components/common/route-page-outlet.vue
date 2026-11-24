<script setup lang="ts">
import { ROUTES_NAMES } from '@/routes/constants';
import { Button } from '@/components/lib/ui/button';
import { computed, onErrorCaptured, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const failedPath = ref<string>();
const renderFailed = ref(false);
const attempt = ref(0);
const direction = ref('kasana-page');
const detailRoutes = new Set<string>([
  ROUTES_NAMES.account,
  ROUTES_NAMES.accountsVehicleDetails,
  ROUTES_NAMES.loanDetail,
  ROUTES_NAMES.automationCreate,
  ROUTES_NAMES.automationDetails,
]);
const stopDirection = router.afterEach((to, from, failure) => {
  if (failure || to.matched[1]?.path === from.matched[1]?.path) return;
  if (to.meta.focusPage === true || from.meta.focusPage === true) {
    direction.value = 'lajur-focus-page';
    return;
  }
  direction.value = detailRoutes.has(String(to.name))
    ? 'lajur-detail-forward'
    : detailRoutes.has(String(from.name))
      ? 'lajur-detail-back'
      : 'kasana-page';
});
onScopeDispose(stopDirection);
const routeKey = computed(() => {
  const path = route.name === ROUTES_NAMES.automationDetails ? route.path : (route.matched[1]?.path ?? route.path);
  return `${path}:${attempt.value}`;
});

const stopListening = router.onError((_error, to) => {
  failedPath.value = to.fullPath;
});
onScopeDispose(stopListening);
watch(
  () => route.fullPath,
  () => {
    failedPath.value = undefined;
    renderFailed.value = false;
  },
);
onErrorCaptured(() => {
  renderFailed.value = true;
});

const retry = async () => {
  if (renderFailed.value) {
    renderFailed.value = false;
    attempt.value += 1;
  } else if (failedPath.value) {
    const failure = await router.push(failedPath.value).catch(() => true);
    if (!failure) failedPath.value = undefined;
  }
};

const deactivateLeavingPage = (element: Element) => {
  if (element instanceof HTMLElement) element.inert = true;
};

const activateEnteringPage = (element: Element) => {
  if (!(element instanceof HTMLElement)) return;
  element.inert = false;
  if (direction.value !== 'kasana-page') element.focus({ preventScroll: true });
};
</script>

<template>
  <section
    v-if="failedPath || renderFailed"
    class="bg-card m-4 grid justify-items-start gap-3 rounded-xl border p-4"
    data-testid="route-page-error"
  >
    <p role="alert">{{ $t('common.errors.pageLoadFailed') }}</p>
    <Button type="button" variant="outline" @click="retry">{{ $t('common.actions.retry') }}</Button>
  </section>
  <div v-if="!renderFailed" class="relative overflow-x-clip">
    <RouterView v-slot="{ Component }">
      <Transition :name="direction" @before-leave="deactivateLeavingPage" @enter="activateEnteringPage">
        <div
          v-if="Component"
          :key="routeKey"
          class="outline-none"
          :class="route.meta.focusPage && 'bg-background'"
          data-testid="route-page"
          tabindex="-1"
        >
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </div>
</template>

<style scoped>
.lajur-focus-page-enter-active {
  position: relative;
  z-index: 1;
}

.lajur-focus-page-leave-active {
  position: absolute;
  inset: 0;
  overflow: clip;
  pointer-events: none;
  transition: opacity var(--kasana-motion-fast) var(--kasana-motion-ease);
}

.lajur-focus-page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lajur-focus-page-leave-active {
    transition: none;
  }
}

.lajur-detail-forward-enter-active,
.lajur-detail-back-enter-active {
  position: relative;
}

.lajur-detail-forward-leave-active,
.lajur-detail-back-leave-active {
  position: absolute;
  inset: 0;
  overflow: clip;
  pointer-events: none;
  transition:
    opacity var(--kasana-motion-fast) var(--kasana-motion-ease),
    transform var(--kasana-motion-normal) var(--kasana-motion-ease);
}

.lajur-detail-forward-leave-to {
  opacity: 0;
  transform: translateX(-1rem);
}

.lajur-detail-back-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

@media (prefers-reduced-motion: reduce) {
  .lajur-detail-forward-leave-active,
  .lajur-detail-back-leave-active {
    transition: none;
  }
}
</style>
