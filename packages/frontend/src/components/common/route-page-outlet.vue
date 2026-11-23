<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import { computed, onErrorCaptured, onScopeDispose, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const failedPath = ref<string>();
const renderFailed = ref(false);
const attempt = ref(0);
const routeKey = computed(() => `${route.matched[1]?.path ?? route.path}:${attempt.value}`);

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

const finishLeave = (_element: Element, done: () => void) => done();
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
  <RouterView v-if="!renderFailed" v-slot="{ Component }">
    <Transition name="kasana-page" @leave="finishLeave">
      <div v-if="Component" :key="routeKey" data-testid="route-page">
        <component :is="Component" />
      </div>
    </Transition>
  </RouterView>
</template>
