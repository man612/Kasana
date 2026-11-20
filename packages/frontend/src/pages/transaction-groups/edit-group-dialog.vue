<script setup lang="ts">
import * as transactionGroupsApi from '@/api/transaction-groups';
import type { TransactionGroupResponse } from '@/api/transaction-groups';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import GroupIconField from '@/components/transactions-list/group-icon-field.vue';
import InputField from '@/components/fields/input-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import { useNotificationCenter } from '@/components/notification-center';
import { syncTransactionGroupQueries } from '@/composable/data-queries/transaction-groups';
import { useQueryClient } from '@tanstack/vue-query';
import { extractApiErrorMessage } from '@/js/errors';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const queryClient = useQueryClient();

const props = defineProps<{
  open?: boolean;
  group: TransactionGroupResponse | null;
  loadError?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [];
  retry: [];
}>();

const { addErrorNotification } = useNotificationCenter();

const form = reactive({ name: '', note: '' as string | undefined, icon: '', iconColor: null as string | null });

const payload = computed(() => ({
  name: form.name.trim(),
  note: form.note?.trim() || null,
  icon: form.icon || null,
  iconColor: form.iconColor,
}));
const snapshot = ref('');
const dirty = computed(() => JSON.stringify(payload.value) !== snapshot.value);

watch(
  [() => props.open, () => props.group?.id],
  ([isOpen]) => {
    if (!isOpen || !props.group) return;
    form.name = props.group.name;
    form.note = props.group.note ?? '';
    form.icon = props.group.icon ?? '';
    form.iconColor = props.group.iconColor ?? null;
    snapshot.value = JSON.stringify(payload.value);
  },
  { immediate: true },
);

const isSaving = ref(false);

const save = async () => {
  if (isSaving.value || !props.group || !payload.value.name || !dirty.value) return;
  isSaving.value = true;
  try {
    const group = await transactionGroupsApi.updateTransactionGroup({
      id: props.group.id,
      payload: payload.value,
    });
    await syncTransactionGroupQueries({ queryClient, groupId: group.id, group });
    emit('update:open', false);
    emit('saved');
  } catch (error) {
    addErrorNotification(extractApiErrorMessage(error) || t('transactionGroups.groupDialog.saveError'));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <ResponsiveDialog :open="open" @update:open="emit('update:open', $event)">
    <template #title>{{ t('transactionGroups.groupDialog.editTitle') }}</template>
    <template #description />

    <div v-if="loadError && !group" class="space-y-2 py-2">
      <p class="text-sm" role="status">{{ $t('transactions.transactionGroups.errors.loadFailed') }}</p>
      <Button variant="outline" size="sm" @click="emit('retry')">{{ $t('common.actions.retry') }}</Button>
    </div>
    <p v-else-if="!group" class="text-muted-foreground py-3 text-sm" role="status">
      {{ $t('transactionGroups.groupDialog.loadingText') }}
    </p>
    <div v-else class="space-y-3 py-2">
      <div class="flex items-end gap-2">
        <InputField
          v-model="form.name"
          class="min-w-0 flex-1"
          :label="$t('transactionGroups.groupDialog.nameLabel')"
          :placeholder="$t('transactions.transactionGroups.createGroupDialog.groupNamePlaceholder')"
          :maxlength="100"
        />
        <GroupIconField v-model="form.icon" v-model:color="form.iconColor" :name="form.name" />
      </div>
      <TextareaField
        v-model="form.note"
        :label="t('transactionGroups.groupDialog.noteLabel')"
        :rows="2"
        :placeholder="t('transactionGroups.groupDialog.notePlaceholder')"
      />
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="emit('update:open', false)">
          {{ t('transactionGroups.groupDialog.cancelButton') }}
        </Button>
        <Button :disabled="!payload.name || !dirty || isSaving" @click="save">
          {{ t('transactionGroups.groupDialog.savingAction') }}
        </Button>
      </div>
    </div>
  </ResponsiveDialog>
</template>
