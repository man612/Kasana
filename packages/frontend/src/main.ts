import '@/styles/global.css';
import './registerServiceWorker';

import { identifyAccentTheme } from '@/common/utils/accent-theme';
import { installChunkReloadHandler } from '@/common/utils/chunk-reload-handler';
import { identifyCurrentTheme } from '@/common/utils/color-theme';
import { installMobileInteractionSounds } from '@/common/utils/mobile-interaction-sound';
import { getDateFnsLocale } from '@/composable/use-date-locale';
import { i18n, initializeLocale, loadChunks } from '@/i18n';
import { i18nChunkGuard } from '@/i18n/route-guard';
import { initPostHog, trackPageviews } from '@/lib/posthog';
import { queryClient } from '@/lib/query-client';
import { stashResetPasswordToken } from '@/lib/reset-password-token';
import { initSentry } from '@/lib/sentry';
import { router } from '@/routes';
import { ROUTES_NAMES } from '@/routes/constants';
import { store } from '@/stores/setup';
import type { SupportedLocale } from '@bt/shared/i18n/locales';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createHead } from '@unhead/vue/client';
import { setDefaultOptions } from 'date-fns';
import { createApp, nextTick, watchEffect } from 'vue';

import App from './app.vue';

stashResetPasswordToken();
identifyCurrentTheme();
identifyAccentTheme();
if (!import.meta.env.DEV) {
  installChunkReloadHandler({
    router,
    hasInAppRecovery: () => router.currentRoute.value.matched[0]?.name === ROUTES_NAMES.dashboard,
  });
}

// Keep assistive technology and the default date formatter in the active app language.
watchEffect(
  () => {
    document.documentElement.lang = i18n.global.locale.value;
    setDefaultOptions({ locale: getDateFnsLocale() });
  },
  { flush: 'sync' },
);

const initialLocale = initializeLocale();
const localeReady = (async () => {
  if (initialLocale === 'en') return;
  await loadChunks({ locale: initialLocale, chunks: ['common'] });
  i18n.global.locale.value = initialLocale as SupportedLocale;
})().catch((error: unknown) => {
  console.warn('i18n initialization failed, using defaults:', error);
});

const app = createApp(App);
const head = createHead();

const start = async () => {
  // When configured, attach Sentry's Vue hooks before mount.
  await initSentry({ app, router }).catch((error: unknown) => {
    console.warn('Could not initialize error tracking:', error);
  });

  void initPostHog();
  trackPageviews({ router });

  app.use(store);
  app.use(head);
  app.use(i18n);
  app.use(VueQueryPlugin, { queryClient });

  // Session verification can run while the locale is loading. The first route
  // still waits for its own messages before the splash is removed.
  router.beforeResolve(async (...args) => {
    await localeReady;
    return i18nChunkGuard(...args);
  });
  app.use(router);
  await localeReady;
  app.mount('#app');
  // The document splash remains until the router's first component is mounted.
  void router
    .isReady()
    .then(async () => {
      await nextTick();
      const splash = document.getElementById('lajur-boot');
      if (!splash) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !splash.animate) {
        splash.remove();
        return;
      }
      splash.setAttribute('aria-hidden', 'true');
      splash.style.pointerEvents = 'none';
      const exit = splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
      void exit.finished.catch(() => undefined).then(() => splash.remove());
    })
    .catch((error: unknown) => {
      console.error('Initial navigation failed:', error);
      const status = document.getElementById('lajur-boot-status');
      const indicator = document.getElementById('lajur-boot-indicator');
      const retry = document.getElementById('lajur-boot-retry');
      if (status) status.textContent = 'Aplikasi belum dapat dimuat. Periksa koneksi Anda.';
      if (indicator) indicator.hidden = true;
      if (retry) {
        retry.hidden = false;
        retry.addEventListener('click', () => window.location.reload(), { once: true });
      }
    });
  installMobileInteractionSounds();
};

void start();
