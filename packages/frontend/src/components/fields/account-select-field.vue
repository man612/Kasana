<template>
  <!-- Primary transaction account picker: a centered, touch-friendly dialog
       on phones; retain the original Reka Select and keyboard behavior on desktop. -->
  <div v-if="isMobile" class="w-full min-w-0" v-bind="$attrs">
    <FieldLabel :label="hideLabel ? undefined : label" only-template>
      <template v-if="$slots['label-right']" #label-right><slot name="label-right" /></template>
      <div class="flex min-w-0 items-stretch">
        <Dialog.Dialog v-model:open="mobileOpen">
          <Dialog.DialogTrigger as-child>
            <button
              type="button"
              class="border-input bg-input-background focus-visible:ring-ring flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-left text-base focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              :class="[$slots['field-right'] && 'rounded-r-none border-r-0', embedded && EMBEDDED_TRIGGER_CLASS]"
              :aria-label="label || placeholder"
              data-test="account-select-trigger"
              :disabled="disabled"
              :aria-required="required"
            >
              <template v-if="selected">
                <AccountOptionRow
                  :account="selected"
                  :label="getLabel(selected)"
                  variant="trigger"
                  class="min-w-0 flex-1"
                />
              </template>
              <span v-else class="text-muted-foreground min-w-0 flex-1 truncate">{{ placeholder || label }}</span>
              <ChevronDownIcon
                class="text-muted-foreground size-4 shrink-0 transition-transform duration-200"
                :class="mobileOpen && 'rotate-180'"
              />
            </button>
          </Dialog.DialogTrigger>
          <Dialog.DialogContent
            data-test="account-select-dialog"
            blur-overlay
            @open-auto-focus.prevent
            class="grid max-h-[min(86dvh,720px)] w-[calc(100vw-2rem)] max-w-md grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0"
          >
            <div class="border-border border-b px-4 py-4 pr-14">
              <Dialog.DialogTitle class="text-base font-semibold">{{ label || placeholder }}</Dialog.DialogTitle>
              <Dialog.DialogDescription class="sr-only">{{ placeholder || label }}</Dialog.DialogDescription>
              <input
                v-if="withSearch && visibleAccounts.length"
                v-model="mobileSearch"
                type="search"
                data-test="account-select-search"
                class="border-input bg-input-background mt-3 h-11 w-full rounded-md border px-3 text-base outline-none focus-visible:ring-2"
                :placeholder="$t('fields.select.searchPlaceholder')"
                :aria-label="$t('fields.select.searchPlaceholder')"
              />
            </div>
            <div class="lajur-dialog-scroll min-h-0 overflow-y-auto overscroll-contain p-2">
              <button
                v-for="item in mobileAccounts"
                :key="item.id"
                type="button"
                class="hover:bg-muted/60 flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                :class="selected?.id === item.id && 'bg-primary/10'"
                :disabled="optionDisabled?.(item)"
                :aria-pressed="selected?.id === item.id"
                @click="selectMobile(item)"
              >
                <AccountOptionRow :account="item" :label="getLabel(item)" />
                <StarIcon
                  v-if="!item._isOutOfWallet && item.id === defaultAccountId"
                  class="text-primary-text ml-auto size-3.5 shrink-0 fill-current"
                />
                <CurrencyChip
                  v-if="!item._isOutOfWallet && item.currencyCode !== 'IDR'"
                  :code="item.currencyCode"
                  class="ml-auto"
                />
              </button>
              <div v-if="!hasSelectableAccounts" class="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <WalletIcon class="bg-muted text-muted-foreground size-10 rounded-full p-2.5" aria-hidden="true" />
                <p class="text-sm font-semibold">{{ $t('fields.accountSelect.empty') }}</p>
                <p v-if="allowCreate" class="text-muted-foreground text-sm">
                  {{ $t('fields.accountSelect.createHint') }}
                </p>
                <Button v-if="allowCreate" class="mt-2 min-h-11" @click="openCreate">
                  <PlusIcon class="size-4" />
                  {{ $t('dialogs.manageTransaction.form.addNewAccountButton') }}
                </Button>
              </div>
              <p v-else-if="!mobileAccounts.length" role="status" class="text-muted-foreground p-4 text-center text-sm">
                {{ $t('fields.comboboxAccounts.noResults') }}
              </p>
            </div>
            <div v-if="hasSelectableAccounts && allowCreate" class="border-border border-t p-2">
              <Button type="button" class="min-h-11 w-full justify-start" variant="ghost-primary" @click="openCreate">
                <PlusIcon class="size-4" />
                {{ $t('dialogs.manageTransaction.form.addNewAccountButton') }}
              </Button>
            </div>
            <div v-else-if="!allowCreate && $slots['select-bottom-content']" class="border-border border-t p-2">
              <slot name="select-bottom-content" />
            </div>
            <CreateAccountDialog
              v-if="allowCreate"
              v-model:open="isCreateOpen"
              @created="createdAccount = $event"
              @closed="returnFromCreate"
            />
          </Dialog.DialogContent>
        </Dialog.Dialog>
        <button
          v-if="clearable && selected && !disabled"
          type="button"
          class="text-muted-foreground ml-1 flex size-11 shrink-0 items-center justify-center rounded-md"
          :aria-label="$t('common.actions.clear')"
          @click="selectMobile(null)"
        >
          <XIcon class="size-4" />
        </button>
        <slot name="field-right" />
      </div>
    </FieldLabel>
    <FieldError :error-message="errorMessage" />
  </div>

  <SelectField
    v-else
    ref="selectFieldRef"
    :model-value="selected"
    :values="visibleAccounts"
    :label-key="getLabel"
    value-key="id"
    :with-search="withSearch"
    :search-keys="withSearch ? SEARCH_KEYS : undefined"
    :label="label"
    :placeholder="placeholder"
    :error-message="errorMessage"
    :disabled="disabled"
    :clearable="clearable"
    :required="required"
    :option-disabled="optionDisabled"
    :trigger-class="embedded ? EMBEDDED_TRIGGER_CLASS : undefined"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #trigger="{ item, label: rowLabel }">
      <span class="flex min-w-0 flex-1 items-center gap-2">
        <AccountOptionRow :account="item" :label="rowLabel" variant="trigger" />
        <StarIcon
          v-if="!item._isOutOfWallet && item.id === defaultAccountId"
          class="text-primary-text size-3.5 shrink-0 fill-current"
        />
        <CurrencyChip
          v-if="!item._isOutOfWallet && !embedded && item.currencyCode !== 'IDR'"
          class="ml-auto"
          :code="item.currencyCode"
        />
      </span>
    </template>

    <template #item="{ item, label: rowLabel }">
      <span class="flex w-full min-w-0 items-center gap-2">
        <AccountOptionRow :account="item" :label="rowLabel" />
        <StarIcon
          v-if="!item._isOutOfWallet && item.id === defaultAccountId"
          class="text-primary-text size-3.5 shrink-0 fill-current"
        />
        <CurrencyChip
          v-if="!item._isOutOfWallet && item.currencyCode !== 'IDR'"
          class="ml-auto"
          :code="item.currencyCode"
        />
      </span>
    </template>

    <template v-if="$slots['label-right']" #label-right>
      <slot name="label-right" />
    </template>

    <template v-if="$slots['field-right']" #field-right>
      <slot name="field-right" />
    </template>

    <template v-if="$slots['select-bottom-content']" #select-bottom-content>
      <slot name="select-bottom-content" />
    </template>
  </SelectField>
</template>

<script setup lang="ts">
import CreateAccountDialog from '@/components/dialogs/create-account-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import CurrencyChip from '@/components/common/currency-chip.vue';
import AccountOptionRow from '@/components/dialogs/manage-transaction/components/account-option-row.vue';
import SelectField from '@/components/fields/select-field.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import FieldError from '@/components/fields/components/field-error.vue';
import * as Dialog from '@/components/lib/ui/dialog';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { OUT_OF_WALLET_ACCOUNT_MOCK } from '@/common/const';
import { getAccountDisplayLabel } from '@/common/utils/account-display';
import { filterDropdownAccounts, useAccountDropdownPrefs } from '@/composable/use-account-dropdown-prefs';
import { ChevronDownIcon, PlusIcon, StarIcon, WalletIcon, XIcon } from '@lucide/vue';
import { AccountModel } from '@bt/shared/types';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

type AccountOption = AccountModel & { _isOutOfWallet?: boolean };

const SEARCH_KEYS: ['name', 'currencyCode'] = ['name', 'currencyCode'];
const EMBEDDED_TRIGGER_CLASS = 'rounded-none border-0 bg-transparent px-2 focus:ring-0 focus:ring-offset-0';
const props = withDefaults(
  defineProps<{
    modelValue: AccountModel | null;
    /** Full option universe: no out-of-wallet mock, unfiltered for archived. */
    accounts: AccountModel[];
    includeOutOfWallet?: boolean;
    /** Offer archived accounts regardless of the global dropdown preference. */
    includeArchived?: boolean;
    label?: string;
    hideLabel?: boolean;
    placeholder?: string;
    errorMessage?: string;
    disabled?: boolean;
    clearable?: boolean;
    required?: boolean;
    withSearch?: boolean;
    allowCreate?: boolean;
    optionDisabled?: (account: AccountModel) => boolean;
    /** Borderless trigger for a segment of a wider field; the host shows the currency. */
    embedded?: boolean;
  }>(),
  {
    label: undefined,
    placeholder: undefined,
    errorMessage: undefined,
    optionDisabled: undefined,
    withSearch: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [account: AccountModel | null];
}>();

const { t } = useI18n();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
const mobileOpen = ref(false);
const mobileSearch = ref('');
const isCreateOpen = ref(false);
let createdAccount: AccountModel | undefined;
let createTrigger: HTMLElement | null;
const openCreate = (event: MouseEvent) => {
  createTrigger = event.currentTarget as HTMLElement;
  isCreateOpen.value = true;
};
const returnFromCreate = () => {
  if (createdAccount) {
    const account = createdAccount;
    createdAccount = undefined;
    selectMobile(account);
  } else if (mobileOpen.value) {
    createTrigger?.focus({ preventScroll: true });
  }
  createTrigger = null;
};
// Escape, backdrop taps and the close X should not preserve a stale filter.
watch(mobileOpen, (open) => {
  if (!open) {
    mobileSearch.value = '';
    isCreateOpen.value = false;
  }
});
const mobileAccounts = computed(() => {
  const search = mobileSearch.value.trim().toLowerCase();
  return search
    ? visibleAccounts.value.filter(
        (a) => getLabel(a).toLowerCase().includes(search) || a.currencyCode.toLowerCase().includes(search),
      )
    : visibleAccounts.value;
});
const selectMobile = (account: AccountOption | null) => {
  emit('update:modelValue', account);
  mobileOpen.value = false;
  mobileSearch.value = '';
};
const { showArchivedInDropdowns, defaultAccountId } = useAccountDropdownPrefs();

// The mock's `name` is an i18n key, real accounts keep their "(archived)"/"(shared by @owner)" suffixes.
const getLabel = (account: AccountOption) =>
  account._isOutOfWallet ? t(account.name) : getAccountDisplayLabel(account);

const selectFieldRef = ref<{ open: () => void } | null>(null);
defineExpose({
  open: () => {
    if (isMobile.value) mobileOpen.value = true;
    else selectFieldRef.value?.open();
  },
});

// Widen the selection to the option type so select-field's generic resolves to AccountOption.
const selected = computed<AccountOption | null>(() => props.modelValue);

const visibleAccounts = computed<AccountOption[]>(() => {
  const accounts = filterDropdownAccounts({
    accounts: props.accounts,
    showArchived: props.includeArchived || showArchivedInDropdowns.value,
    selectedId: props.modelValue?.id,
  });
  return props.includeOutOfWallet ? [OUT_OF_WALLET_ACCOUNT_MOCK, ...accounts] : accounts;
});
const hasSelectableAccounts = computed(() => visibleAccounts.value.some((account) => !props.optionDisabled?.(account)));
</script>
