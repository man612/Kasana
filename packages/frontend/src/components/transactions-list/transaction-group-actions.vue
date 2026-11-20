<script setup lang="ts">
import { deleteTransactionGroup } from '@/api/transaction-groups';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/lib/ui/popover';
import { useNotificationCenter } from '@/components/notification-center';
import { syncTransactionGroupQueries, transactionGroupDetailQuery } from '@/composable/data-queries/transaction-groups';
import { extractApiErrorMessage } from '@/js/errors';
import { EllipsisIcon, PencilIcon, Trash2Icon } from '@lucide/vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, defineAsyncComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const EditGroupDialog = defineAsyncComponent(() => import('@/pages/transaction-groups/edit-group-dialog.vue'));
const props = defineProps<{ groupId: string; name: string }>();
const emit = defineEmits<{ saved: []; deleted: [] }>();
const queryClient = useQueryClient();
const { addErrorNotification } = useNotificationCenter();
const { t } = useI18n();
const menuOpen = ref(false);
const editOpen = ref(false);
const deleteOpen = ref(false);
const isDeleting = ref(false);
const {
  data: group,
  isError,
  refetch,
} = useQuery(
  computed(() => ({
    ...transactionGroupDetailQuery({ id: props.groupId }),
    enabled: editOpen.value,
  })),
);

const edit = () => {
  editOpen.value = true;
  menuOpen.value = false;
};
const confirmDelete = () => {
  deleteOpen.value = true;
  menuOpen.value = false;
};
const remove = async () => {
  if (isDeleting.value) return;
  isDeleting.value = true;
  try {
    await deleteTransactionGroup({ id: props.groupId });
    deleteOpen.value = false;
    await syncTransactionGroupQueries({ queryClient, groupId: props.groupId, group: null });
    emit('deleted');
  } catch (error) {
    addErrorNotification(extractApiErrorMessage(error) || t('transactions.transactionGroups.groupsPage.deleteError'));
  } finally {
    isDeleting.value = false;
  }
};
const onMenuClose = (event: Event) => {
  if (editOpen.value || deleteOpen.value) event.preventDefault();
};
</script>

<template>
  <Popover v-model:open="menuOpen" modal>
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="text-muted-foreground size-11 shrink-0"
        :aria-label="$t('transactions.transactionGroups.groupsPage.moreActions', { name })"
      >
        <EllipsisIcon class="size-4" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      dim-backdrop
      align="end"
      class="w-max max-w-[calc(100vw-1.5rem)] min-w-40 p-1"
      :aria-label="$t('transactions.transactionGroups.groupsPage.moreActions', { name })"
      @close-auto-focus="onMenuClose"
    >
      <Button type="button" variant="ghost" class="min-h-11 w-full justify-start" @click="edit">
        <PencilIcon class="size-4" aria-hidden="true" />
        {{ $t('transactionGroups.groupDialog.editAction') }}
      </Button>
      <Button type="button" variant="ghost-destructive" class="min-h-11 w-full justify-start" @click="confirmDelete">
        <Trash2Icon class="size-4" aria-hidden="true" />
        {{ $t('transactionGroups.groupDialog.deleteAction') }}
      </Button>
    </PopoverContent>
  </Popover>

  <EditGroupDialog
    v-if="editOpen || group"
    v-model:open="editOpen"
    :group="group ?? null"
    :load-error="isError"
    @retry="refetch()"
    @saved="emit('saved')"
  />

  <ResponsiveAlertDialog
    v-model:open="deleteOpen"
    :confirm-label="$t('common.actions.delete')"
    confirm-variant="destructive"
    @confirm="remove"
  >
    <template #title>{{ $t('transactionGroups.groupDialog.deleteGroupTitle') }}</template>
    <template #description>{{
      $t('transactionGroups.groupDialog.deleteGroupDescription', { groupName: name })
    }}</template>
  </ResponsiveAlertDialog>
</template>
