<script setup lang="ts">
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { Button } from '@/components/lib/ui/button';
import { transactionGroupDetailQuery } from '@/composable/data-queries/transaction-groups';
import { type TransactionModel, dedupeTransferLegs } from '@bt/shared/types';
import { ChevronDownIcon } from '@lucide/vue';
import { useQuery } from '@tanstack/vue-query';
import { format } from 'date-fns';
import { computed, ref, useId, watch } from 'vue';

import GroupIcon from './group-icon.vue';
import TransactionGroupActions from './transaction-group-actions.vue';
import TransactionRecord from './transaction-record.vue';

export interface GroupRowData {
  type: 'group';
  groupId: string;
  groupName: string;
  icon?: string | null;
  iconColor?: string | null;
  transactionCount: number;
  dateFrom: Date;
  dateTo: Date;
  members: TransactionModel[];
}

const props = defineProps<{
  group: GroupRowData;
  expanded?: boolean;
  expandable?: boolean;
  previewLimit?: number;
}>();

const emit = defineEmits<{
  click: [groupId: string];
  toggle: [groupId: string];
  'record-click': [[transaction: TransactionModel, opposite: TransactionModel | undefined]];
}>();

const membersId = useId();
const hasExpanded = ref(Boolean(props.expanded));
watch(
  () => props.expanded,
  (expanded) => {
    if (expanded) hasExpanded.value = true;
  },
);

const detail = useQuery(
  computed(() => ({
    ...transactionGroupDetailQuery({ id: props.group.groupId }),
    enabled: Boolean(props.expanded) && props.expandable,
  })),
);
const members = computed(() =>
  detail.data.value?.transactions ? dedupeTransferLegs(detail.data.value.transactions) : props.group.members,
);

const visibleMembers = computed(() => members.value.slice(0, props.previewLimit));
const hasMoreMembers = computed(
  () =>
    props.previewLimit !== undefined &&
    (detail.data.value?.transactions ? members.value.length : props.group.transactionCount) > props.previewLimit,
);

const dateRange = computed(() => {
  const from = format(props.group.dateFrom, 'd MMM');
  const to = format(props.group.dateTo, 'd MMM yyyy');
  const fromFull = format(props.group.dateFrom, 'd MMM yyyy');
  if (fromFull === to) return to;
  return `${from} – ${to}`;
});
</script>

<template>
  <div class="bg-primary/5 border-primary/20 rounded-lg border">
    <div class="flex min-w-0 items-center">
      <Button
        type="button"
        variant="ghost"
        class="h-auto min-h-13 min-w-0 flex-1 justify-start gap-2 px-2 py-1 text-left"
        @click="emit('click', group.groupId)"
      >
        <GroupIcon :icon="group.icon" :color="group.iconColor" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold">{{ group.groupName }}</span>
          <span class="text-muted-foreground block truncate text-xs font-normal">
            {{ group.transactionCount }} {{ $t('transactionGroups.transactionGroupRecord.transactionCountLabel') }} ·
            {{ dateRange }}
          </span>
        </span>
      </Button>
      <TransactionGroupActions :group-id="group.groupId" :name="group.groupName" />
      <Button
        v-if="expandable"
        type="button"
        variant="ghost"
        size="icon"
        class="text-muted-foreground size-11 shrink-0"
        :aria-expanded="Boolean(expanded)"
        :aria-controls="membersId"
        :aria-label="
          $t(
            expanded
              ? 'transactions.transactionGroups.inline.collapse'
              : 'transactions.transactionGroups.inline.expand',
            { name: group.groupName },
          )
        "
        @click="emit('toggle', group.groupId)"
      >
        <ChevronDownIcon
          class="size-4 motion-safe:transition-transform motion-safe:duration-200"
          :class="expanded && 'rotate-180'"
        />
      </Button>
    </div>
    <LayoutCollapse v-if="expandable" :id="membersId" :open="Boolean(expanded)">
      <div
        v-if="hasExpanded"
        class="border-border/60 mx-2 mb-2 grid gap-1 border-t pt-2 pl-2"
        :aria-busy="detail.isFetching.value"
      >
        <TransactionRecord
          v-for="(member, index) in visibleMembers"
          :key="member.id"
          :tx="member"
          :index="index"
          @record-click="emit('record-click', $event)"
        />
        <Button
          v-if="hasMoreMembers"
          type="button"
          variant="ghost"
          size="sm"
          class="justify-self-end"
          @click="emit('click', group.groupId)"
        >
          {{ $t('common.actions.viewAll') }}
        </Button>
        <Button v-if="detail.isError.value" type="button" variant="outline" size="sm" @click="detail.refetch()">
          {{ $t('common.actions.retry') }}
        </Button>
      </div>
    </LayoutCollapse>
  </div>
</template>
