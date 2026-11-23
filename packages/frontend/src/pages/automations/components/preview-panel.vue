<script setup lang="ts">
import { Button } from '@/components/lib/ui/button';
import TransactionRecord from '@/components/transactions-list/transaction-record.vue';
import { usePreviewAutomation } from '@/composable/data-queries/transaction-automations';
import { extractApiErrorMessage } from '@/js/errors';
import type { AutomationConditions } from '@bt/shared/types';
import { Loader2Icon, PlayIcon } from '@lucide/vue';
import { computed, shallowRef } from 'vue';

import AutomationChipTrack from './automation-chip-track.vue';
import type { AutomationChip } from './automation-chips';
import type { AutomationActionDraft } from './condition-registry';

const props = defineProps<{
  conditions: AutomationConditions;
  actions: AutomationActionDraft[];
  actionChips: AutomationChip[];
  disabled: boolean;
}>();

const preview = usePreviewAutomation();

const signature = computed(() => JSON.stringify({ conditions: props.conditions, actions: props.actions }));
const lastRun = shallowRef<{ signature: string; chips: AutomationChip[] }>();
const isStale = computed(() => lastRun.value && lastRun.value.signature !== signature.value);

const run = () => {
  const snapshot = { signature: signature.value, chips: [...props.actionChips] };
  preview.mutate({ conditions: props.conditions }, { onSuccess: () => (lastRun.value = snapshot) });
};
</script>

<template>
  <div class="flex flex-col gap-3">
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="self-start"
      :disabled="disabled || preview.isPending.value"
      @click="run"
    >
      <Loader2Icon v-if="preview.isPending.value" class="size-4 animate-spin" />
      <PlayIcon v-else class="size-4" />
      {{ $t('automations.editor.preview.run') }}
    </Button>

    <p class="text-muted-foreground text-xs">{{ $t('automations.editor.preview.scope') }}</p>
    <p v-if="disabled" class="text-muted-foreground text-xs">{{ $t('automations.editor.preview.hint') }}</p>

    <p v-if="preview.isError.value" class="text-destructive-text text-xs">
      {{ extractApiErrorMessage(preview.error.value) || $t('automations.editor.preview.error') }}
    </p>

    <template v-if="preview.data.value">
      <p v-if="isStale" class="text-warning-text text-xs" role="status">{{ $t('automations.editor.preview.stale') }}</p>

      <p class="text-muted-foreground text-xs" role="status">
        {{
          $t('automations.editor.preview.summary', {
            matched: preview.data.value.matchedCount,
            scanned: preview.data.value.scannedCount,
          })
        }}
      </p>

      <p v-if="preview.data.value.matches.length === 0" class="text-muted-foreground text-xs">
        {{ $t('automations.editor.preview.empty') }}
      </p>

      <div v-else class="grid gap-2">
        <div v-if="lastRun?.chips.length" class="bg-muted/40 grid gap-1 rounded-lg px-3 py-2">
          <h3 class="text-sm font-medium">{{ $t('automations.editor.preview.after') }}</h3>
          <AutomationChipTrack :chips="lastRun.chips" variant="then" density="comfortable" />
          <p class="text-muted-foreground text-xs">{{ $t('automations.editor.preview.notApplied') }}</p>
        </div>
        <h3 class="text-muted-foreground text-xs font-medium">{{ $t('automations.editor.preview.before') }}</h3>
        <TransactionRecord v-for="tx in preview.data.value.matches" :key="tx.id" :tx="tx" :as-button="false" compact />
      </div>
    </template>
  </div>
</template>
