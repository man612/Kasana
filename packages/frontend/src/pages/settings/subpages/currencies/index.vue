<template>
  <Card class="@container/currencies max-w-4xl">
    <CardHeader class="flex flex-col gap-2 border-b">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="min-w-0 text-2xl font-semibold">{{ $t('settings.currencies.page.title') }}</h2>

        <div class="flex flex-col items-start gap-1 sm:items-end">
          <Button variant="outline" size="sm" disabled :title="$t('settings.currencies.idrBetaNotice')">
            <LockKeyholeIcon class="size-4" />
            {{ $t('settings.currencies.addNew.sectionLabel') }}
          </Button>
          <span class="text-muted-foreground max-w-64 text-xs leading-snug">
            {{ $t('settings.currencies.idrBetaNotice') }}
          </span>
        </div>
      </div>

      <p class="text-sm opacity-80">
        {{ $t('settings.currencies.page.description') }}
        <HowItWorksPopover />
      </p>
    </CardHeader>

    <CardContent class="mt-6">
      <CurrenciesList />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';

import { Button } from '@/components/lib/ui/button';
import { LockKeyholeIcon } from '@lucide/vue';
import HowItWorksPopover from './how-it-works-popover.vue';
import CurrenciesList from './list.vue';
</script>
