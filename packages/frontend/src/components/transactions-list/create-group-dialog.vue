<script setup lang="ts">
import * as transactionGroupsApi from '@/api/transaction-groups';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import GroupIconField from '@/components/transactions-list/group-icon-field.vue';
import InputField from '@/components/fields/input-field.vue';
import TextareaField from '@/components/fields/textarea-field.vue';
import { syncTransactionGroupQueries } from '@/composable/data-queries/transaction-groups';
import { getApiErrorMessage } from '@/js/errors';
import { useQueryClient } from '@tanstack/vue-query';
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  open?: boolean;
  transactionIds: string[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [];
}>();

const queryClient = useQueryClient();

const form = reactive({
  name: '',
  note: '',
  icon: '',
  iconColor: null as string | null,
});

const isSubmitting = ref(false);
const error = ref('');

watch(
  () => props.open,
  (val) => {
    if (val) {
      form.name = '';
      form.note = '';
      form.icon = '';
      form.iconColor = null;
      error.value = '';
    }
  },
);

const handleSubmit = async () => {
  if (isSubmitting.value) return;
  if (!form.name.trim()) {
    error.value = t('transactions.transactionGroups.errors.nameRequired');
    return;
  }
  if (props.transactionIds.length < 2) {
    error.value = t('transactions.transactionGroups.errors.minTransactions', { min: 2 });
    return;
  }

  isSubmitting.value = true;
  error.value = '';

  try {
    const group = await transactionGroupsApi.createTransactionGroup({
      name: form.name.trim(),
      note: form.note.trim() || null,
      icon: form.icon || null,
      iconColor: form.iconColor,
      transactionIds: props.transactionIds,
    });

    await syncTransactionGroupQueries({ queryClient, groupId: group.id, group });

    emit('update:open', false);
    emit('created');
  } catch (e) {
    error.value = getApiErrorMessage({
      e,
      t,
      conflictKey: 'transactions.transactionGroups.errors.alreadyInGroup',
      fallbackKey: 'transactions.transactionGroups.errors.createFailed',
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <ResponsiveDialog
    :open="open"
    custom-close
    dialog-content-class="sm:max-w-md"
    @update:open="emit('update:open', $event)"
  >
    <template #title>{{ t('transactions.transactionGroups.createGroupDialog.title') }}</template>
    <template #description>
      {{ $t('transactions.transactionGroups.createGroupDialog.selected', { count: transactionIds.length }) }}
    </template>

    <form class="space-y-4 py-2" @submit.prevent="handleSubmit">
      <div class="flex items-end gap-2">
        <InputField
          class="min-w-0 flex-1"
          v-model="form.name"
          :label="t('transactions.transactionGroups.createGroupDialog.groupNameLabel')"
          :placeholder="t('transactions.transactionGroups.createGroupDialog.groupNamePlaceholder')"
          :maxlength="100"
        />
        <GroupIconField v-model="form.icon" v-model:color="form.iconColor" :name="form.name" />
      </div>
      <TextareaField
        v-model="form.note"
        :label="t('transactions.transactionGroups.createGroupDialog.noteLabel')"
        :rows="2"
        :placeholder="t('transactions.transactionGroups.createGroupDialog.notePlaceholder')"
      />

      <p v-if="error" class="text-destructive-text text-sm">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <Button type="button" variant="ghost" @click="emit('update:open', false)">{{
          t('transactions.transactionGroups.createGroupDialog.cancelButton')
        }}</Button>
        <Button type="submit" :disabled="isSubmitting || !form.name.trim()">
          {{
            isSubmitting
              ? t('transactions.transactionGroups.createGroupDialog.creatingText')
              : t('transactions.transactionGroups.createGroupDialog.buttonLabel')
          }}
        </Button>
      </div>
    </form>
  </ResponsiveDialog>
</template>
