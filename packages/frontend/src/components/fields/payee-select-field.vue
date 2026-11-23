<script setup lang="ts">
import { useAccountPayees, useDeletePayee, usePayeeLookup, usePayees } from '@/composable/data-queries/payees';
import * as Popover from '@/components/lib/ui/popover';
import * as Dialog from '@/components/lib/ui/dialog';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { ScrollArea } from '@/components/lib/ui/scroll-area';
import { Button } from '@/components/lib/ui/button';
import { cn } from '@/lib/utils';
import { EllipsisIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from '@lucide/vue';
import { useDebounce } from '@vueuse/core';
import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot } from 'reka-ui';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PayeeModel, TransactionLocation } from '@bt/shared/types';
import PayeeFormDialog from '@/pages/settings/subpages/payees/components/payee-form-dialog.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import { useNotificationCenter } from '@/components/notification-center';
import { extractApiErrorMessage } from '@/js/errors';
import BrandLogo from '@/components/common/brand-logo.vue';
import { toEntityLogoDisplayProps } from '@/components/common/logo-selection';
import FieldLabel from './components/field-label.vue';

const DEBOUNCE_MS = 200;

interface Props {
  modelValue: string | null | undefined;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  managePayees?: boolean;
  historicalName?: string;
  /** When set, this Payee id is filtered out of the dropdown (e.g. the source of a merge). */
  excludeId?: string | null;
  /**
   * Account context for the picker. When provided AND the account is shared
   * with the caller, swap to the owner-scoped list so the picker matches the
   * payee namespace the backend write paths validate against. When the
   * account is owned by the caller, it's the caller's own list (same as
   * undefined). Owner-scoped fetch is enabled by `ownerScoped`.
   */
  accountId?: string | null;
  /**
   * Set by the parent when `accountId` resolves to a shared account, telling
   * this component to route through `useAccountPayees` instead of `usePayees`.
   * Inline create is hidden in this mode (recipient can't create payees in the
   * owner's namespace from a transaction form).
   */
  ownerScoped?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  placeholder: undefined,
  disabled: false,
  managePayees: false,
  historicalName: undefined,
  excludeId: null,
  accountId: null,
  ownerScoped: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
  /**
   * Fires only on user-driven selection; payload carries the Payee's
   * `defaultCategoryId` (explicit user setting), `topCategoryId` (the
   * most-used category derived from past transactions) and `defaultTagIds`
   * (the Payee's auto-apply tag rule). Callers use the default category first
   * and fall back to the top when no default is set.
   */
  (
    e: 'payee-selected',
    payload: {
      payeeId: string;
      defaultCategoryId: string | null;
      topCategoryId: string | null;
      defaultTagIds: string[];
      defaultLocation: TransactionLocation | null;
    },
  ): void;
}>();

const { t } = useI18n();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
const preventMobileAutoFocus = (event: Event) => {
  if (isMobile.value) event.preventDefault();
};

const isOpen = ref(false);
const triggerRef = ref<HTMLButtonElement>();
const inputValue = ref('');
// Closing via Escape, outside tap, or the close X should never preserve stale
// recipient search terms when this dialog is reopened.
watch(isOpen, (open) => {
  if (!open) inputValue.value = '';
});
const debouncedRaw = useDebounce(inputValue, DEBOUNCE_MS);
const debouncedQuery = computed(() => debouncedRaw.value.trim());

// Sort by last-seen so the most recently used payees lead – that's what the
// user typically reaches for when entering a new transaction. The backend
// default is `transactionCount`, which would surface lifetime favourites
// instead of "what I just paid".
//
// On a shared account we swap to `useAccountPayees` so the dropdown shows
// the account owner's payees (matching the backend write-path validation).
// The inactive composable is left disabled to keep cache keys distinct and
// avoid double fetches.
const ownerFetch = useAccountPayees({
  accountId: () => props.accountId ?? undefined,
  q: computed(() => (debouncedQuery.value.length > 0 ? debouncedQuery.value : undefined)),
  sortBy: 'lastSeen',
  sortDir: 'desc',
  enabled: computed(() => props.ownerScoped && props.accountId !== null),
});
const callerFetch = usePayees({
  q: computed(() => (debouncedQuery.value.length > 0 ? debouncedQuery.value : undefined)),
  sortBy: 'lastSeen',
  sortDir: 'desc',
  enabled: computed(() => !props.ownerScoped),
});
const allPayees = computed(() => (props.ownerScoped ? ownerFetch.list.value : callerFetch.list.value));
const isFetching = computed(() => (props.ownerScoped ? ownerFetch.isFetching.value : callerFetch.isFetching.value));

const displayPayees = computed(() =>
  props.excludeId ? allPayees.value.filter((p) => p.id !== props.excludeId) : allPayees.value,
);

// Results land after the debounced fetch, not on input: re-highlight then, and ignore
// picks until then so Enter can't choose a row from the previous query's list.
const listboxRef = ref<{ highlightFirstItem: () => void } | null>(null);
watch(displayPayees, () => listboxRef.value?.highlightFirstItem());
const isSearchPending = computed(() => inputValue.value.trim() !== debouncedQuery.value || isFetching.value);

// Inline create is hidden in owner-scoped mode – the caller can't create
// payees in the account owner's namespace from the transaction form.
const showCreateAffordance = computed(() => !props.ownerScoped);

const createLabel = computed(() => {
  if (debouncedQuery.value.length === 0) return t('fields.payeeSelect.createNew');
  return t('fields.payeeSelect.createAffordance', { name: debouncedQuery.value });
});

// Resolve the selected payee's name+logo from the full lookup, not the dropdown
// list: the assigned payee is often absent from the search/lastSeen-limited list
// (e.g. editing a transaction whose payee is rarely used). On a shared account the
// payee lives in the owner's namespace, which the caller's lookup doesn't hold, so
// resolve from the owner-scoped list there.
const { byId: payeeLookupById } = usePayeeLookup();
const selectedPayee = computed(() => {
  if (!props.modelValue) return null;
  if (props.ownerScoped) return ownerFetch.list.value.find((p) => p.id === props.modelValue) ?? null;
  return payeeLookupById.value.get(props.modelValue) ?? null;
});

const selectedLabel = computed(
  () => selectedPayee.value?.name ?? (!props.modelValue ? props.historicalName : '') ?? '',
);

const placeholderResolved = computed(() => props.placeholder ?? t('fields.payeeSelect.placeholder'));

function selectPayee(payee: {
  id: string;
  defaultCategoryId: string | null;
  defaultTagIds?: string[];
  defaultLocation?: TransactionLocation | null;
  stats?: { topCategoryId: string | null } | null;
}) {
  emit('update:modelValue', payee.id);
  emit('payee-selected', {
    payeeId: payee.id,
    defaultCategoryId: payee.defaultCategoryId,
    topCategoryId: payee.stats?.topCategoryId ?? null,
    defaultTagIds: payee.defaultTagIds ?? [],
    defaultLocation: payee.defaultLocation ?? null,
  });
  isOpen.value = false;
  inputValue.value = '';
}

defineExpose({ open: () => (isOpen.value = true) });

function clearSelection() {
  emit('update:modelValue', null);
  triggerRef.value?.focus({ preventScroll: true });
}

const editorOpen = ref(false);
const editorPayee = ref<PayeeModel | null>(null);
const createDialogInitialName = ref('');
const actionsOpen = ref(false);
const deleteOpen = ref(false);
const actionPayee = ref<PayeeModel | null>(null);
const deleteMutation = useDeletePayee();
const { addErrorNotification } = useNotificationCenter();

async function openEditor(payee: PayeeModel | null) {
  editorPayee.value = payee;
  createDialogInitialName.value = inputValue.value.trim();
  actionsOpen.value = false;
  isOpen.value = false;
  await nextTick();
  editorOpen.value = true;
}

function handlePayeeSaved(payee: PayeeModel) {
  if (!editorPayee.value) selectPayee(payee);
}

async function openDelete() {
  actionsOpen.value = false;
  isOpen.value = false;
  await nextTick();
  deleteOpen.value = true;
}

async function removePayee() {
  const payee = actionPayee.value;
  if (!payee || deleteMutation.isPending.value) return;
  try {
    await deleteMutation.mutateAsync({ id: payee.id });
    if (props.modelValue === payee.id) clearSelection();
    deleteOpen.value = false;
  } catch (error) {
    addErrorNotification(extractApiErrorMessage(error) || t('payees.errors.generic'));
  }
}
</script>

<template>
  <FieldLabel :label="label" only-template>
    <component
      :is="isMobile ? Dialog.Dialog : Popover.Popover"
      :open="isOpen"
      @update:open="(open: boolean) => (isOpen = open)"
    >
      <div class="relative">
        <component :is="isMobile ? Dialog.DialogTrigger : Popover.PopoverTrigger" as-child>
          <button
            ref="triggerRef"
            type="button"
            :disabled="disabled"
            :class="
              cn(
                'border-input bg-input-background not-dark:hover:bg-accent ring-offset-background flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm md:h-9',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
                modelValue && !disabled && 'pr-11',
                disabled && 'cursor-not-allowed opacity-50',
              )
            "
            data-test="payee-select-field"
          >
            <Transition name="lajur-payee-value" mode="out-in">
              <span :key="modelValue || selectedLabel" class="flex min-w-0 flex-1 items-center gap-2">
                <BrandLogo
                  v-if="selectedPayee"
                  v-bind="toEntityLogoDisplayProps(selectedPayee)"
                  :name="selectedPayee.name"
                  class="size-5 shrink-0"
                />
                <span
                  class="text-muted-foreground min-w-0 flex-1 truncate text-left"
                  :class="{ 'text-foreground': selectedLabel }"
                >
                  {{ selectedLabel || placeholderResolved }}
                </span>
              </span>
            </Transition>
          </button>
        </component>
        <Transition name="lajur-payee-clear">
          <Button
            v-if="modelValue && !disabled"
            type="button"
            variant="ghost"
            size="icon"
            class="text-muted-foreground absolute inset-y-0 right-0 h-full w-11"
            :aria-label="t('common.actions.clear')"
            @click="clearSelection"
          >
            <XIcon class="size-4" aria-hidden="true" />
          </Button>
        </Transition>
      </div>

      <component
        :is="isMobile ? Dialog.DialogContent : Popover.PopoverContent"
        @open-auto-focus="preventMobileAutoFocus"
        v-bind="isMobile ? { blurOverlay: true } : { align: 'start', sideOffset: 4 }"
        :class="
          isMobile
            ? 'max-h-[min(85dvh,680px)] w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden rounded-2xl p-0'
            : 'w-(--reka-popover-trigger-width) p-0'
        "
      >
        <template v-if="isMobile">
          <Dialog.DialogTitle class="px-4 pt-4 pr-14 text-base font-semibold">
            {{ label || placeholderResolved }}
          </Dialog.DialogTitle>
          <Dialog.DialogDescription class="sr-only">
            {{ t('fields.payeeSelect.searchPlaceholder') }}
          </Dialog.DialogDescription>
        </template>
        <ListboxRoot ref="listboxRef" :model-value="modelValue ?? null" highlight-on-hover>
          <div class="border-input border-b p-2">
            <div class="relative">
              <SearchIcon class="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
              <ListboxFilter
                v-model="inputValue"
                class="border-input bg-input-background h-9 w-full rounded-md border pr-2 pl-8 text-sm focus:outline-none"
                :placeholder="t('fields.payeeSelect.searchPlaceholder')"
                data-test="payee-select-search"
              />
            </div>
          </div>

          <ScrollArea
            :class="isMobile ? 'max-h-[48dvh] min-h-0 flex-1' : showCreateAffordance ? 'max-h-72' : 'max-h-64'"
          >
            <ListboxContent>
              <div v-for="item in displayPayees" :key="item.id" class="flex items-center">
                <ListboxItem
                  :value="item.id"
                  class="data-highlighted:bg-popover-foreground/10 data-[state=checked]:bg-primary/15 data-[state=checked]:data-highlighted:bg-primary/20 flex min-w-0 flex-1 cursor-pointer items-center gap-2 p-2 text-sm"
                  @mousedown.prevent
                  @select.prevent="!isSearchPending && selectPayee(item)"
                >
                  <BrandLogo v-bind="toEntityLogoDisplayProps(item)" :name="item.name" class="size-6 shrink-0" />
                  <span class="min-w-0 grow truncate">{{ item.name }}</span>
                </ListboxItem>
                <Popover.Popover
                  v-if="managePayees && !ownerScoped"
                  :open="actionsOpen && actionPayee?.id === item.id"
                  modal
                  @update:open="
                    (open) => {
                      if (open) actionPayee = item;
                      actionsOpen = open;
                    }
                  "
                >
                  <Popover.PopoverTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-11 shrink-0"
                      :aria-label="t('payees.actions.moreFor', { name: item.name })"
                    >
                      <EllipsisIcon class="size-4" aria-hidden="true" />
                    </Button>
                  </Popover.PopoverTrigger>
                  <Popover.PopoverContent dim-backdrop align="end" class="w-max min-w-36 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      class="min-h-11 w-full justify-start"
                      @click="openEditor(item)"
                    >
                      <PencilIcon class="size-4" aria-hidden="true" />{{ t('payees.actions.edit') }}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost-destructive"
                      class="min-h-11 w-full justify-start"
                      @click="openDelete"
                    >
                      <Trash2Icon class="size-4" aria-hidden="true" />{{ t('common.actions.delete') }}
                    </Button>
                  </Popover.PopoverContent>
                </Popover.Popover>
              </div>

              <div
                v-if="displayPayees.length === 0 && !isFetching && !showCreateAffordance"
                class="text-muted-foreground p-4 text-center text-sm"
              >
                {{ $t('fields.payeeSelect.empty') }}
              </div>
            </ListboxContent>
          </ScrollArea>
        </ListboxRoot>

        <!-- Pinned outside the ScrollArea so it stays visible while the user
             scrolls the list. -->

        <Button
          v-if="showCreateAffordance"
          variant="ghost"
          class="w-full justify-start gap-2 rounded-none border-t"
          data-test="payee-select-create"
          @click="openEditor(null)"
        >
          <PlusIcon class="size-4" />
          {{ createLabel }}
        </Button>
      </component>
    </component>

    <PayeeFormDialog
      v-model:open="editorOpen"
      :payee="editorPayee"
      :initial-name="createDialogInitialName"
      @saved="handlePayeeSaved"
    />
    <ResponsiveAlertDialog
      v-model:open="deleteOpen"
      :confirm-label="t('common.actions.delete')"
      confirm-variant="destructive"
      @confirm="removePayee"
    >
      <template #title>{{ t('payees.detail.deletePayeeTitle') }}</template>
      <template #description>{{ t('payees.actions.deleteWithHistory', { name: actionPayee?.name }) }}</template>
    </ResponsiveAlertDialog>
  </FieldLabel>
</template>
