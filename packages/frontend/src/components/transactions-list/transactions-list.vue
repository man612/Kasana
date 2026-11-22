<script lang="ts" setup>
import type { TagsIndicatorVariant } from '@/components/common/tags-indicator.vue';
import { useScrollAreaContainer } from '@/composable/scroll-area-container';
import { type MatchingTransactions, useBulkTransactionActions } from '@/composable/use-bulk-transaction-actions';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { type TransactionTimeGrouping, TransactionModel } from '@bt/shared/types';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { createReusableTemplate, useDocumentVisibility, useEventListener, useIntervalFn } from '@vueuse/core';
import { ListIcon } from '@lucide/vue';
import {
  computed,
  defineAsyncComponent,
  nextTick,
  reactive,
  ref,
  TransitionGroup,
  watch,
  watchEffect,
  type ComponentPublicInstance,
} from 'vue';
import { useI18n } from 'vue-i18n';

import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { SCROLL_AREA_IDS } from '../lib/ui/scroll-area/types';
import BulkActionDialogs from './bulk-action-dialogs.vue';
import BulkEditToolbar from './bulk-edit-toolbar.vue';
import PlannedRowsToggle from './planned-rows-toggle.vue';
import TransactionDetailsModal from './transaction-details-modal.vue';
import TransactionGroupRecord, { type GroupRowData } from './transaction-group-record.vue';
import TransactionRecord from './transaction-record.vue';
import TransactionTimeHeading from './transaction-time-heading.vue';
import {
  buildTimeSectionRows,
  isTimeSection,
  isTransactionTimeInRange,
  type TransactionTimeRange,
  type TransactionTimeSection,
} from './time-sections';
import { startOfDay } from 'date-fns';
import { useManageTransactionDialog } from './use-manage-transaction-dialog';
import { PLANNED_HEADER, useCollapsedPlanned } from './use-collapsed-planned';
import { getDisplayItemKey, isGroupRow, useTransactionsDisplay } from './use-transactions-display';

const { t } = useI18n();

const ManageTransactionDialogContent = defineAsyncComponent(
  () => import('@/components/dialogs/manage-transaction/dialog-content.vue'),
);
const TransactionGroupDialog = defineAsyncComponent(
  () => import('@/pages/transaction-groups/transaction-group-dialog.vue'),
);
const LoanPaymentDialog = defineAsyncComponent(() => import('@/pages/loans/components/loan-payment-dialog/index.vue'));

const props = withDefaults(
  defineProps<{
    transactions: TransactionModel[];
    isTransactionRecord?: boolean;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    paginate?: boolean;
    scrollAreaId?: SCROLL_AREA_IDS;
    rawList?: boolean; // whenever we don't need to show anything except actual records
    maxDisplay?: number; // maximum number of items to display after deduplication
    enableBulkEdit?: boolean;
    pinBulkToolbar?: boolean;
    expandGroups?: boolean;
    groupPreviewLimit?: number;
    /** When true, content filters are active — groups dissolve and individual transactions show */
    contentFiltersActive?: boolean;
    /** For scoped lists (e.g. a single payee) where a group row would misrepresent the set and hide per-row actions */
    disableGrouping?: boolean;
    selectionScopeKey?: string;
    /** Totals and filters of the whole result set; enables "select all" beyond the loaded rows. */
    matching?: MatchingTransactions;
    compact?: boolean;
    animateChanges?: boolean;
    hideDate?: boolean;
    hidePlannedMarker?: boolean;
    tagsVariant?: TagsIndicatorVariant;
    showAccount?: boolean;
    timeGrouping?: TransactionTimeGrouping;
    timeAscending?: boolean;
    timeGroupRange?: TransactionTimeRange;
  }>(),
  {
    isTransactionRecord: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    paginate: true,
    scrollAreaId: SCROLL_AREA_IDS.dashboard,
    enableBulkEdit: false,
    contentFiltersActive: false,
    disableGrouping: false,
    timeGrouping: 'none',
  },
);
const emits = defineEmits(['fetch-next-page']);
const [DefineRowTemplate, UseRowTemplate] = createReusableTemplate<{
  item: TransactionModel | GroupRowData | TransactionTimeSection | typeof PLANNED_HEADER;
  index: number;
}>();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

// Transaction display (deduplication, grouping, transfer normalization)
const { displayTransactions } = useTransactionsDisplay({
  transactions: () => props.transactions,
  contentFiltersActive: () => props.contentFiltersActive,
  disableGrouping: () => props.disableGrouping,
  maxDisplay: () => props.maxDisplay,
});

// Raw lists are narrow slices (e.g. the planned-overview widget), where collapsing would hide everything.
const {
  rows: collapsedRows,
  visibleItems,
  isPlannedExpanded,
  plannedCount,
} = useCollapsedPlanned({
  items: displayTransactions,
  isPlanned: (item) => !isGroupRow(item) && item.isPlanned,
  enabled: () => !props.rawList,
});
const today = ref(startOfDay(new Date()));
const documentVisibility = useDocumentVisibility();
const { resume: watchDayBoundary, pause: pauseDayBoundary } = useIntervalFn(
  () => {
    const localDay = startOfDay(new Date());
    if (+localDay !== +today.value) today.value = localDay;
  },
  60_000,
  { immediate: false, immediateCallback: true },
);
watch(
  () => props.timeGrouping !== 'none' && documentVisibility.value === 'visible',
  (active) => (active ? watchDayBoundary() : pauseDayBoundary()),
  { immediate: true },
);

const rows = computed<(TransactionModel | GroupRowData | TransactionTimeSection | typeof PLANNED_HEADER)[]>(() => {
  const mode = props.timeGrouping;
  if (mode === 'none') return collapsedRows.value;
  const sections = buildTimeSectionRows({
    items: visibleItems.value,
    mode,
    ascending: props.timeAscending,
    getTime: (item) => {
      if (!isGroupRow(item)) return new Date(item.time);
      const date = item.latestTime ? new Date(item.latestTime) : item.dateTo;
      return props.timeGroupRange && !isTransactionTimeInRange(date, props.timeGroupRange) ? item.dateTo : date;
    },
  });
  return collapsedRows.value.includes(PLANNED_HEADER) ? [PLANNED_HEADER, ...sections] : sections;
});
const keyForRow = ({ row, index }: { row: (typeof rows.value)[number] | undefined; index: number }) => {
  if (row === PLANNED_HEADER) return 'planned-header';
  if (isTimeSection(row)) return row.key;
  return getDisplayItemKey(row, index);
};
const rowKey = (index: number) => keyForRow({ row: rows.value[index], index });
const hasRowDivider = (index: number) => {
  const nextRow = rows.value[index + 1];
  return Boolean(nextRow && nextRow !== PLANNED_HEADER && !isTimeSection(nextRow) && !isGroupRow(nextRow));
};

// Transaction detail dialog (Dialog on desktop, Drawer on mobile). transfer_to_loan
// pairs route to a separate, simpler loan dialog with its own visibility flag.
const {
  isDialogVisible,
  editSession,
  dialogProps,
  isCompactDialog,
  handleRecordClick,
  closeDialog,
  isLoanDialogVisible,
  loanDialogProps,
  closeLoanDialog,
} = useManageTransactionDialog();

// Scroll / virtualizer setup
const inheritedScrollContainer = useScrollAreaContainer(props.scrollAreaId);
const ownScrollArea = ref<InstanceType<typeof ScrollArea> | null>(null);
const scrollElement = computed(() =>
  props.pinBulkToolbar
    ? ownScrollArea.value?.viewportRef?.viewportElement
    : inheritedScrollContainer.value?.viewportElement,
);
const [DefineRows, UseRows] = createReusableTemplate();

const listContainerRef = ref<HTMLElement | null>(null);
const scrollMargin = ref(0);

// Measure distance from scroll element top to list container top.
// TanStack Virtual needs this when the list is offset within the scroll element.
watch(
  [listContainerRef, scrollElement],
  ([el, scrollEl]) => {
    if (el && scrollEl) {
      scrollMargin.value = el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    }
  },
  { flush: 'post' },
);

// Selection, eligibility, bulk mutations and dialog state — shared with the table view.
const bulkActions = useBulkTransactionActions({
  getTransactions: () => visibleItems.value.filter((item): item is TransactionModel => !isGroupRow(item)),
  getScopeKey: () => props.selectionScopeKey,
  getMatching: () => props.matching,
  getHasNextPage: () => props.hasNextPage,
});
const {
  selectedCount,
  isAllSelected,
  isGroupingBlocked,
  isTransactionSelectable,
  isTransactionSelected,
  toggleTransaction,
  clearSelection,
  getUnselectableReason,
  hasExternalSelected,
  selectedTotals,
  handleSelectAllToggle,
  isBulkEditDialogOpen,
  isCreateGroupDialogOpen,
  isAddToGroupDialogOpen,
  isBulkDeleteDialogOpen,
  isBulkLoading,
} = bulkActions;

// Group detail dialog
const isGroupDialogOpen = ref(false);
const expandedGroups = reactive(new Set<string>());
const groupDialogPreview = ref<GroupRowData>();

const handleGroupRowClick = (groupId: string) => {
  groupDialogPreview.value = displayTransactions.value.find(
    (row): row is GroupRowData => isGroupRow(row) && row.groupId === groupId,
  );
  isGroupDialogOpen.value = true;
};

const toggleGroup = (id: string) => {
  if (expandedGroups.has(id)) expandedGroups.delete(id);
  else expandedGroups.add(id);
};
watch(
  () => props.selectionScopeKey,
  () => expandedGroups.clear(),
);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length + (props.hasNextPage ? 1 : 0),
    getScrollElement: () => scrollElement.value,
    estimateSize: (index) => (isTimeSection(rows.value[index]) ? 36 : 60),
    getItemKey: ((currentRows) => (index) => {
      return keyForRow({ row: currentRows[index], index });
    })(rows.value),
    overscan: 10,
    scrollMargin: scrollMargin.value,
    enabled: props.paginate && !!scrollElement.value,
  })),
);

const measureRow = (element: Element | ComponentPublicInstance | null) => {
  virtualizer.value.measureElement(element instanceof HTMLElement ? element : null);
};

defineExpose({
  virtualizer,
  scrollToIndex: (index: number) => virtualizer.value.scrollToIndex(index),
  scrollToOffset: (offset: number) => virtualizer.value.scrollToOffset(offset),
});

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());
const listScrollTop = ref(0);
const updateScrollTop = () => {
  listScrollTop.value = scrollElement.value?.scrollTop ?? 0;
};
watch(scrollElement, updateScrollTop, { flush: 'post' });
useEventListener(scrollElement, 'scroll', updateScrollTop, { passive: true });
// A visual copy stays inside the viewport below the pinned bulk toolbar.
// The original heading remains in the virtual sequence and accessible to AT.
const stickySection = computed(() => {
  const virtualItems = virtualRows.value;
  if (props.timeGrouping === 'none' || !virtualItems.length) return undefined;
  const offset = listScrollTop.value;
  if (offset <= scrollMargin.value) return undefined;
  const firstVisible = virtualItems.find((item) => item.end > offset);
  if (!firstVisible || (firstVisible.start >= offset && isTimeSection(rows.value[firstVisible.index])))
    return undefined;
  const section = sectionByRow.value[firstVisible.index];
  if (!section) return undefined;
  const nextHeading = virtualItems.find((item) => item.start > offset && isTimeSection(rows.value[item.index]));
  return { section, push: nextHeading ? Math.min(0, nextHeading.start - offset - 36) : 0 };
});
const sectionByRow = computed(() => {
  let section: TransactionTimeSection | undefined;
  return rows.value.map((row) => {
    if (isTimeSection(row)) section = row;
    return section;
  });
});

let layoutRevision = 0;
watch(
  () => props.timeGrouping,
  async () => {
    const revision = ++layoutRevision;
    const instance = virtualizer.value;
    const offset = instance.scrollOffset ?? 0;
    const first = instance.getVirtualItems().find((item) => item.end > offset && !String(item.key).startsWith('time-'));
    const relativeTop = first ? first.start - offset : 0;
    const viewport = scrollElement.value?.getBoundingClientRect();
    const canAnimate = viewport && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const oldPositions = new Map<string, number>();
    if (canAnimate) {
      listContainerRef.value?.querySelectorAll<HTMLElement>('[data-row-key]').forEach((row) => {
        const rect = row.getBoundingClientRect();
        if (rect.bottom > viewport.top && rect.top < viewport.bottom) oldPositions.set(row.dataset.rowKey!, rect.top);
      });
    }
    await nextTick();
    if (revision !== layoutRevision) return;
    if (first && offset > scrollMargin.value) {
      const index = rows.value.findIndex((_, candidate) => rowKey(candidate) === first.key);
      const target = index >= 0 ? virtualizer.value.getOffsetForIndex(index, 'start') : undefined;
      if (target) virtualizer.value.scrollToOffset(target[0] - relativeTop);
    }
    if (!oldPositions.size) return;
    requestAnimationFrame(() => {
      if (revision !== layoutRevision) return;
      listContainerRef.value?.querySelectorAll<HTMLElement>('[data-row-key]').forEach((row) => {
        const top = oldPositions.get(row.dataset.rowKey!);
        if (top === undefined) return;
        const shift = top - row.getBoundingClientRect().top;
        if (Math.abs(shift) < 2 || Math.abs(shift) > viewport!.height) return;
        row.getAnimations().forEach((animation) => {
          if (animation.id === 'transaction-time-reorder') animation.cancel();
        });
        const move = row.animate([{ translate: `0 ${shift}px` }, { translate: '0 0' }], {
          duration: 180,
          easing: 'ease-out',
        });
        move.id = 'transaction-time-reorder';
      });
    });
  },
  { flush: 'sync' },
);

const changedRowKeys = new Set<string>();
const liveRowKeys = computed(
  () => new Set(props.animateChanges ? rows.value.map((_, index) => String(rowKey(index))) : []),
);
watch(liveRowKeys, (current, previous) => {
  if (!props.animateChanges) return;
  changedRowKeys.clear();
  for (const key of current) if (!previous.has(key)) changedRowKeys.add(key);
});
const animateRow = (element: Element, done: () => void, entering: boolean) => {
  if (!(element instanceof HTMLElement) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
  const key = element.dataset.rowKey ?? '';
  if (entering ? !changedRowKeys.delete(key) : liveRowKeys.value.has(key)) return done();
  const fade = [
    { opacity: 0, translate: '0 -4px' },
    { opacity: 1, translate: '0 0' },
  ];
  const animation = element.animate(entering ? fade : fade.reverse(), { duration: 160, easing: 'ease-out' });
  void animation.finished.then(done, done);
};

watchEffect(() => {
  const lastItem = virtualRows.value.at(-1);

  if (!lastItem) return;

  if (lastItem.index >= rows.value.length - 1 && props.hasNextPage && !props.isFetchingNextPage) {
    emits('fetch-next-page');
  }
});
</script>

<template>
  <div :class="pinBulkToolbar && 'flex h-full min-h-0 flex-col overflow-hidden'">
    <!-- Bulk edit toolbar -->
    <BulkEditToolbar
      v-if="enableBulkEdit && displayTransactions.length > 0"
      :class="pinBulkToolbar && 'static shrink-0'"
      :selected-count="selectedCount"
      :is-all-selected="isAllSelected"
      :is-loading="isBulkLoading"
      :has-external-selected="hasExternalSelected"
      :selected-totals="selectedTotals"
      :matching-summary="matching?.summary"
      :is-grouping-blocked="isGroupingBlocked"
      @cancel="clearSelection"
      @edit="isBulkEditDialogOpen = true"
      @delete="isBulkDeleteDialogOpen = true"
      @create-group="isCreateGroupDialogOpen = true"
      @add-to-group="isAddToGroupDialogOpen = true"
      @select-all="handleSelectAllToggle"
    />

    <!-- Bulk edit / group / delete dialogs -->
    <BulkActionDialogs v-if="enableBulkEdit" :actions="bulkActions" />

    <!-- Reusable row template: renders a group row or a transaction row with leading/trailing slots -->
    <DefineRowTemplate v-slot="{ item, index }">
      <TransactionTimeHeading v-if="isTimeSection(item)" :section="item" :today="today" />
      <PlannedRowsToggle
        v-else-if="item === PLANNED_HEADER"
        v-model="isPlannedExpanded"
        :count="plannedCount"
        class="h-13 w-full rounded-md"
      />
      <TransactionGroupRecord
        v-else-if="isGroupRow(item)"
        :group="item"
        :expandable="enableBulkEdit || expandGroups"
        :preview-limit="groupPreviewLimit"
        :time-range="timeGrouping === 'none' ? undefined : timeGroupRange"
        :grouped-by-day="timeGrouping === 'day'"
        :expanded="expandedGroups.has(item.groupId)"
        @click="handleGroupRowClick"
        @toggle="toggleGroup"
        @record-click="handleRecordClick"
      />

      <div v-else class="flex items-center gap-1">
        <slot name="row-leading" :tx="item as TransactionModel" />
        <div class="min-w-0 flex-1">
          <TransactionRecord
            :tx="item as TransactionModel"
            :show-divider="hasRowDivider(index)"
            :show-checkbox="enableBulkEdit"
            :compact="compact"
            :hide-date="hideDate"
            :show-time="timeGrouping === 'day'"
            :tags-variant="tagsVariant"
            :show-account="showAccount"
            :hide-planned-marker="hidePlannedMarker || !rawList"
            :is-selected="isTransactionSelected((item as TransactionModel).id)"
            :is-selectable="isTransactionSelectable(item as TransactionModel)"
            :unselectable-reason="getUnselectableReason(item as TransactionModel)"
            :index="index"
            @record-click="handleRecordClick"
            @selection-change="toggleTransaction"
          />
        </div>
        <slot name="row-trailing" :tx="item as TransactionModel" />
      </div>
    </DefineRowTemplate>

    <DefineRows>
      <div
        v-if="enableBulkEdit && !rows.length && !hasNextPage"
        class="grid justify-items-center gap-2 px-4 py-12 text-center"
      >
        <div class="bg-muted text-muted-foreground grid size-10 place-items-center rounded-full">
          <ListIcon class="size-5" aria-hidden="true" />
        </div>
        <p class="text-sm font-medium">
          {{ $t(contentFiltersActive ? 'transactions.table.emptyTitle' : 'transactions.list.empty') }}
        </p>
        <p v-if="contentFiltersActive" class="text-muted-foreground text-sm">
          {{ $t('transactions.table.emptyDescription') }}
        </p>
      </div>
      <template v-else-if="paginate">
        <div ref="listContainerRef" class="relative">
          <div v-bind="$attrs" v-if="transactions" class="w-full">
            <div
              v-if="stickySection"
              class="pointer-events-none sticky top-0 z-20 h-0"
              aria-hidden="true"
              data-testid="transaction-time-sticky"
            >
              <TransactionTimeHeading
                :section="stickySection.section"
                :today="today"
                :style="{ transform: `translateY(${stickySection.push}px)` }"
              />
            </div>
            <component
              :is="animateChanges ? TransitionGroup : 'div'"
              v-bind="
                animateChanges
                  ? {
                      tag: 'div',
                      css: false,
                      onEnter: (el: Element, done: () => void) => animateRow(el, done, true),
                      onLeave: (el: Element, done: () => void) => animateRow(el, done, false),
                    }
                  : {}
              "
              :style="{ height: `${totalSize}px` }"
              class="relative"
            >
              <div
                v-for="virtualRow in virtualRows"
                :key="rowKey(virtualRow.index)"
                :data-index="virtualRow.index"
                :data-row-key="animateChanges ? rowKey(virtualRow.index) : undefined"
                :ref="measureRow"
                :style="{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                }"
              >
                <UseRowTemplate
                  v-if="rows[virtualRow.index]"
                  :item="rows[virtualRow.index]!"
                  :index="virtualRow.index"
                />
                <div
                  v-else-if="isFetchingNextPage && !rawList"
                  role="status"
                  class="text-muted-foreground flex min-h-10 items-center justify-center text-sm"
                >
                  {{ t('transactions.list.loadingMore') }}
                </div>
              </div>
            </component>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-bind="$attrs" :class="['grid grid-cols-1 gap-2', expandGroups && 'px-2']">
          <template v-for="(item, index) in rows" :key="rowKey(index)">
            <UseRowTemplate :item="item" :index="index" />
          </template>
        </div>
      </template>
    </DefineRows>
    <ScrollArea v-if="pinBulkToolbar" ref="ownScrollArea" class="min-h-0 flex-1" viewport-class="overscroll-contain">
      <div class="px-2 pt-1 pb-3 sm:px-3"><UseRows /></div>
    </ScrollArea>
    <UseRows v-else />

    <TransactionDetailsModal
      v-slot="{ requestClose }"
      v-model:open="isDialogVisible"
      :session="editSession"
      :mobile="isMobile"
      :is-compact="isCompactDialog"
    >
      <ManageTransactionDialogContent
        ref="editSession"
        v-bind="dialogProps"
        @close-modal="closeDialog"
        @request-close="requestClose"
      />
    </TransactionDetailsModal>

    <!-- Group detail dialog -->
    <TransactionGroupDialog
      v-if="groupDialogPreview"
      v-model:open="isGroupDialogOpen"
      :group-id="groupDialogPreview?.groupId"
      :preview="
        groupDialogPreview && {
          name: groupDialogPreview.groupName,
          icon: groupDialogPreview.icon,
          iconColor: groupDialogPreview.iconColor,
        }
      "
    />

    <!-- Dedicated loan-payment dialog: opens for transfer_to_loan rows -->
    <LoanPaymentDialog
      v-if="loanDialogProps.loanAccount"
      :open="isLoanDialogVisible"
      :loan-account="loanDialogProps.loanAccount"
      :transaction="loanDialogProps.transaction"
      :opposite-transaction="loanDialogProps.oppositeTransaction"
      @update:open="(value) => !value && closeLoanDialog()"
    />
  </div>
</template>
