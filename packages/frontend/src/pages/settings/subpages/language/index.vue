<template>
  <Card class="max-w-4xl">
    <CardHeader class="border-b">
      <h2 class="mb-2 text-2xl font-semibold">{{ $t('settings.language.title') }}</h2>
      <p class="text-sm opacity-80">{{ $t('settings.language.description') }}</p>
    </CardHeader>

    <CardContent class="mt-6 space-y-6">
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="locale in maintainedLocales"
          :key="locale.value"
          :variant="currentLocale === locale.value ? 'default' : 'outline'"
          size="sm"
          :disabled="isUpdating"
          @click="handleLocaleChange(locale.value)"
        >
          <img :src="locale.flagSrc" :alt="locale.native" class="h-4 w-5.5 rounded-sm object-cover" />
          <span>{{ locale.native }}</span>
        </Button>
      </div>

      <div v-if="communityLocales.length" class="space-y-2.5">
        <h3 class="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          {{ $t('settings.language.community.title') }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="locale in communityLocales"
            :key="locale.value"
            :variant="currentLocale === locale.value ? 'default' : 'outline'"
            size="sm"
            :disabled="isUpdating"
            @click="handleLocaleChange(locale.value)"
          >
            <img :src="locale.flagSrc" :alt="locale.native" class="h-4 w-5.5 rounded-sm object-cover" />
            <span>{{ locale.native }}</span>
          </Button>
        </div>
        <p class="text-muted-foreground max-w-prose text-[13px]">{{ $t('settings.language.community.hint') }}</p>
      </div>

      <p class="text-muted-foreground rounded-lg border px-4 py-3 text-sm leading-relaxed">
        Bahasa Indonesia adalah pilihan utama Kasana. Bahasa lain tetap tersedia,
        dan sebagian terjemahan komunitas mungkin belum lengkap.
      </p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import Button from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
import { useUserSettings } from '@/composable/data-queries/user-settings';
import { FLAG_SRCS, getCurrentLocale, setLocale } from '@/i18n';
import { trackAnalyticsEvent } from '@/lib/posthog';
import { COMMUNITY_LOCALES, LOCALE_NAMES, SUPPORTED_LOCALES, type SupportedLocale } from '@bt/shared/i18n/locales';
import { ref } from 'vue';

const { data: userSettings, mutateAsync, isUpdating } = useUserSettings();

const currentLocale = ref<SupportedLocale>(getCurrentLocale() as SupportedLocale);

const availableLocales = Object.values(SUPPORTED_LOCALES).map((value) => ({
  value,
  native: LOCALE_NAMES[value].native,
  flagSrc: FLAG_SRCS[value],
}));
const maintainedLocales = availableLocales.filter((locale) => !COMMUNITY_LOCALES.has(locale.value));
const communityLocales = availableLocales.filter((locale) => COMMUNITY_LOCALES.has(locale.value));

const handleLocaleChange = async (locale: SupportedLocale) => {
  const previousLocale = currentLocale.value;
  if (previousLocale === locale) return;

  currentLocale.value = locale;
  await setLocale(locale);

  trackAnalyticsEvent({
    event: 'language_changed',
    properties: { from_locale: previousLocale, to_locale: locale },
  });

  try {
    await mutateAsync({ ...userSettings.value, locale });
  } catch {
    // localStorage is already updated by setLocale; backend persistence is best-effort
    console.error('Failed to persist locale to backend');
  }
};
</script>
