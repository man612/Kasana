<script setup lang="ts">
import { loadTransactionAttachments } from '@/api/attachments';
import { VERBOSE_PAYMENT_TYPES, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import AttachmentViewerDialog from '@/components/dialogs/manage-transaction/components/attachment-viewer-dialog.vue';
import TransactionTimeLabel from '@/components/dialogs/manage-transaction/components/transaction-time-label.vue';
import { Button } from '@/components/lib/ui/button';
import { usePayeeLookup } from '@/composable/data-queries/payees';
import { useFormatCurrency } from '@/composable/formatters';
import { ROUTES_NAMES } from '@/routes/constants';
import { useAccountsStore, useCategoriesStore } from '@/stores';
import {
  ACCOUNT_CATEGORIES,
  TRANSACTION_TRANSFER_NATURE,
  TRANSACTION_TYPES,
  type AccountModel,
  type TransactionAttachmentModel,
  type TransactionModel,
} from '@bt/shared/types';
import { ArrowRightIcon, ExternalLinkIcon, PaperclipIcon, PencilIcon, XIcon } from '@lucide/vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  transaction: TransactionModel;
  oppositeTransaction?: TransactionModel;
  editable: boolean;
  preparingEditor?: boolean;
  loanAccount?: AccountModel;
}>();
const emit = defineEmits<{ edit: []; close: [] }>();
const { t } = useI18n();
const { accountsRecord } = storeToRefs(useAccountsStore());
const { categoriesMap } = storeToRefs(useCategoriesStore());
const { nameById: payeeNames } = usePayeeLookup();
const { formatAmountByCurrencyCode } = useFormatCurrency();

const isTransfer = computed(() => props.transaction.transferNature !== TRANSACTION_TRANSFER_NATURE.not_transfer);
const isIncome = computed(() => props.transaction.transactionType === TRANSACTION_TYPES.income);
const isVehicleAdjustment = computed(
  () =>
    props.transaction.transferNature === TRANSACTION_TRANSFER_NATURE.transfer_out_wallet &&
    accountsRecord.value[props.transaction.accountId]?.accountCategory === ACCOUNT_CATEGORIES.vehicle,
);
const isAssetAdjustment = computed(() => isVehicleAdjustment.value || Boolean(props.transaction.isBalanceAdjustment));
const typeLabel = computed(() => {
  if (isVehicleAdjustment.value) return t('dialogs.manageTransaction.vehicleLinked.title');
  if (isAssetAdjustment.value) return t('transactions.readView.adjustment');
  if (props.transaction.transferNature === TRANSACTION_TRANSFER_NATURE.transfer_to_loan)
    return t('transactions.readView.loan');
  if (isTransfer.value) return t('transactions.readView.transfer');
  return t(isIncome.value ? 'transactions.readView.income' : 'transactions.readView.expense');
});
const date = computed(() => new Date(props.transaction.time));
const payer = computed(() => (props.transaction.payeeId ? payeeNames.value[props.transaction.payeeId] : undefined));
const categoryName = computed(() => categoriesMap.value[props.transaction.categoryId]?.name);
const payeeName = computed(() => payer.value || props.transaction.payeeNameSnapshot);
const heading = computed(() => payeeName.value || props.loanAccount?.name || categoryName.value || typeLabel.value);
const showCategory = computed(() => categoryName.value && !isTransfer.value && heading.value !== categoryName.value);
const accountName = (id: string | undefined) => (id ? accountsRecord.value[id]?.name : undefined);
const ourAccount = computed(() => accountName(props.transaction.accountId));
const otherAccount = computed(
  () =>
    accountName(props.oppositeTransaction?.accountId) ||
    (props.transaction.transferNature === TRANSACTION_TRANSFER_NATURE.transfer_out_wallet
      ? t('common.outOfWallet')
      : undefined),
);
const payerAccount = computed(() => (isIncome.value ? otherAccount.value : ourAccount.value));
const receiverAccount = computed(() => (isIncome.value ? ourAccount.value : otherAccount.value));
const accountAmounts = computed(() => {
  const [from, to] = isIncome.value
    ? [props.oppositeTransaction, props.transaction]
    : [props.transaction, props.oppositeTransaction];
  if (!from || !to || from.currencyCode === to.currencyCode) return null;
  return [
    formatAmountByCurrencyCode(from.amount, from.currencyCode),
    formatAmountByCurrencyCode(to.amount, to.currencyCode),
  ];
});
const paymentMethod = computed(() =>
  VERBOSE_PAYMENT_TYPES.find((option) => option.value === props.transaction.paymentType),
);
const externalLink = computed(() => {
  const value = props.transaction.externalUrl;
  return value && /^https?:\/\//i.test(value) ? value : null;
});
const {
  data: attachments,
  isError: attachmentError,
  refetch: retryAttachments,
} = useQuery({
  queryKey: computed(() => [...VUE_QUERY_CACHE_KEYS.transactionAttachments, props.transaction.id]),
  queryFn: () => loadTransactionAttachments({ transactionId: props.transaction.id }),
  enabled: computed(() => props.transaction.hasAttachments !== false),
});
const activeAttachment = ref<TransactionAttachmentModel | null>(null);
const attachmentOpen = ref(false);
const showAttachment = (attachment: TransactionAttachmentModel) => {
  activeAttachment.value = attachment;
  attachmentOpen.value = true;
};
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-col" data-testid="transaction-read-view">
    <div class="border-border flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
      <p class="text-sm font-semibold" tabindex="-1" data-transaction-heading>
        {{ $t('transactions.list.detailsTitle') }}
      </p>
      <Button type="button" variant="ghost" size="icon" :aria-label="$t('common.ui.close')" @click="emit('close')">
        <XIcon class="size-4" aria-hidden="true" />
      </Button>
    </div>
    <div
      class="lajur-dialog-scroll min-h-0 min-w-0 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 wrap-anywhere sm:px-6"
    >
      <div class="space-y-1.5">
        <div
          v-if="heading !== typeLabel || transaction.isPlanned || transaction.isPending"
          class="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
        >
          <span v-if="heading !== typeLabel">{{ typeLabel }}</span>
          <span v-if="transaction.isPlanned || transaction.isPending" class="bg-muted rounded-full px-2 py-0.5 text-xs">
            {{ $t(transaction.isPlanned ? 'transactions.readView.planned' : 'transactions.readView.pending') }}
          </span>
        </div>
        <h3 class="text-lg font-semibold">{{ heading }}</h3>
        <p
          class="text-2xl leading-tight font-semibold tabular-nums"
          :class="
            isTransfer || isAssetAdjustment
              ? 'text-foreground'
              : isIncome
                ? 'text-app-income-color'
                : 'text-app-expense-color'
          "
        >
          {{ formatAmountByCurrencyCode(transaction.paymentTotal ?? transaction.amount, transaction.currencyCode) }}
        </p>
        <p class="text-muted-foreground text-sm">
          <TransactionTimeLabel :value="date" :live="false" />
        </p>
      </div>

      <dl
        v-if="ourAccount || otherAccount || paymentMethod || transaction.externalReference || showCategory"
        class="divide-border divide-y border-y text-sm"
      >
        <div v-if="isTransfer && !isAssetAdjustment && (payerAccount || receiverAccount)" class="grid gap-2 py-3">
          <dt class="text-muted-foreground">{{ $t('transactions.readView.accounts') }}</dt>
          <dd class="flex min-w-0 items-start gap-2">
            <div v-if="payerAccount" class="min-w-0 flex-1">
              <strong class="font-semibold">{{ payerAccount }}</strong>
              <p v-if="accountAmounts" class="text-muted-foreground tabular-nums">{{ accountAmounts[0] }}</p>
            </div>
            <ArrowRightIcon
              v-if="payerAccount && receiverAccount"
              class="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div v-if="receiverAccount" class="min-w-0 flex-1">
              <RouterLink
                v-if="loanAccount && receiverAccount === loanAccount.name"
                :to="{ name: ROUTES_NAMES.loanDetail, params: { id: loanAccount.id } }"
                class="text-primary-text font-semibold underline-offset-4 hover:underline focus-visible:underline"
              >
                {{ receiverAccount }}
              </RouterLink>
              <strong v-else class="font-semibold">{{ receiverAccount }}</strong>
              <p v-if="accountAmounts" class="text-muted-foreground tabular-nums">{{ accountAmounts[1] }}</p>
            </div>
          </dd>
        </div>
        <div v-else-if="ourAccount" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 py-2">
          <dt class="text-muted-foreground">{{ $t('transactions.table.columns.account') }}</dt>
          <dd class="text-right">{{ ourAccount }}</dd>
        </div>
        <div v-if="showCategory" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 py-2">
          <dt class="text-muted-foreground">{{ $t('transactions.table.columns.category') }}</dt>
          <dd class="text-right">{{ categoryName }}</dd>
        </div>
        <div v-if="paymentMethod" class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 py-2">
          <dt class="text-muted-foreground">{{ $t('transactions.readView.method') }}</dt>
          <dd class="text-right">{{ $t(paymentMethod.label) }}</dd>
        </div>
        <div v-if="transaction.externalReference" class="grid gap-1 py-2">
          <dt class="text-muted-foreground">{{ $t('transactions.readView.reference') }}</dt>
          <dd>{{ transaction.externalReference }}</dd>
        </div>
      </dl>

      <ul
        v-if="transaction.paymentParts && transaction.paymentParts.length > 1"
        class="border-border divide-border divide-y rounded-lg border px-3 text-sm"
        :aria-label="$t('transactions.readView.accounts')"
      >
        <li
          v-for="part in transaction.paymentParts"
          :key="part.transactionId"
          class="flex flex-wrap justify-between gap-x-3 py-2"
        >
          <span v-if="accountName(part.accountId)">{{ accountName(part.accountId) }}</span>
          <span class="tabular-nums">{{ formatAmountByCurrencyCode(part.amount, part.currencyCode) }}</span>
        </li>
      </ul>
      <ul
        v-if="transaction.splits?.length"
        class="border-border divide-border divide-y rounded-lg border px-3 text-sm"
        :aria-label="$t('transactions.table.columns.split')"
      >
        <li v-for="split in transaction.splits" :key="split.id" class="grid gap-1 py-2">
          <div class="flex flex-wrap justify-between gap-x-3">
            <span>{{ split.category?.name ?? categoriesMap[split.categoryId]?.name }}</span>
            <span class="tabular-nums">{{ formatAmountByCurrencyCode(split.amount, transaction.currencyCode) }}</span>
          </div>
          <p v-if="split.note" class="text-muted-foreground break-words">{{ split.note }}</p>
        </li>
      </ul>

      <div v-if="transaction.note" class="space-y-1.5 text-sm">
        <p class="text-muted-foreground">{{ $t('transactions.table.columns.note') }}</p>
        <p class="whitespace-pre-wrap">{{ transaction.note }}</p>
      </div>

      <div
        v-if="
          transaction.tags?.length ||
          externalLink ||
          transaction.location ||
          transaction.originalAmount != null ||
          transaction.transactionGroups?.length
        "
        class="space-y-2 text-sm"
      >
        <div v-if="transaction.tags?.length" class="flex flex-wrap gap-1">
          <span v-for="tag in transaction.tags" :key="tag.id" class="bg-muted max-w-full rounded-full px-2 py-1">{{
            tag.name
          }}</span>
        </div>
        <p v-if="transaction.location" class="text-muted-foreground break-words">
          {{ $t('transactions.readView.location') }} · {{ transaction.location.latitude }},
          {{ transaction.location.longitude }}
        </p>
        <p v-if="transaction.originalAmount != null && transaction.originalCurrencyCode" class="text-muted-foreground">
          {{ $t('transactions.table.columns.originalAmount') }} ·
          {{ formatAmountByCurrencyCode(transaction.originalAmount, transaction.originalCurrencyCode) }}
        </p>
        <p v-if="transaction.transactionGroups?.length" class="text-muted-foreground break-words">
          {{ $t('transactions.table.columns.group') }} ·
          {{ transaction.transactionGroups.map(({ name }) => name).join(', ') }}
        </p>
        <Button v-if="externalLink" variant="outline" size="sm" as-child>
          <a :href="externalLink" rel="noopener noreferrer" target="_blank"
            ><ExternalLinkIcon class="size-4" aria-hidden="true" />{{ $t('transactions.readView.link') }}</a
          >
        </Button>
      </div>

      <div v-if="attachments?.length" class="flex flex-wrap gap-2">
        <Button
          v-for="file in attachments"
          :key="file.id"
          type="button"
          variant="outline"
          class="h-auto min-h-9 max-w-full items-start whitespace-normal"
          @click="showAttachment(file)"
        >
          <PaperclipIcon class="size-4 shrink-0" aria-hidden="true" /><span class="min-w-0 text-left">{{
            file.filename
          }}</span>
        </Button>
      </div>
      <Button v-else-if="attachmentError" type="button" variant="outline" size="sm" @click="retryAttachments">
        <PaperclipIcon class="size-4" aria-hidden="true" />{{ $t('common.actions.retry') }}
      </Button>
    </div>
    <div v-if="editable" class="border-border flex shrink-0 justify-end border-t px-4 py-3 sm:px-6">
      <Button
        type="button"
        class="min-h-11 w-full sm:w-auto"
        :disabled="preparingEditor"
        :aria-busy="preparingEditor"
        @click="emit('edit')"
      >
        <PencilIcon class="size-4" aria-hidden="true" />{{ $t('common.actions.edit') }}
      </Button>
    </div>
    <AttachmentViewerDialog v-if="activeAttachment" v-model:open="attachmentOpen" :attachment="activeAttachment" />
  </div>
</template>
