<script setup lang="ts">
import { loadTransactionAttachments } from '@/api/attachments';
import { VERBOSE_PAYMENT_TYPES, VUE_QUERY_CACHE_KEYS } from '@/common/const';
import AttachmentViewerDialog from '@/components/dialogs/manage-transaction/components/attachment-viewer-dialog.vue';
import TransactionTimeLabel from '@/components/dialogs/manage-transaction/components/transaction-time-label.vue';
import { Button } from '@/components/lib/ui/button';
import { usePayeeLookup } from '@/composable/data-queries/payees';
import { useFormatCurrency } from '@/composable/formatters';
import { useAccountsStore, useCategoriesStore } from '@/stores';
import {
  TRANSACTION_TRANSFER_NATURE,
  TRANSACTION_TYPES,
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
}>();
const emit = defineEmits<{ edit: []; close: [] }>();
const { t } = useI18n();
const { accountsRecord } = storeToRefs(useAccountsStore());
const { categoriesMap } = storeToRefs(useCategoriesStore());
const { nameById: payeeNames } = usePayeeLookup();
const { formatAmountByCurrencyCode } = useFormatCurrency();

const isTransfer = computed(() => props.transaction.transferNature !== TRANSACTION_TRANSFER_NATURE.not_transfer);
const isIncome = computed(() => props.transaction.transactionType === TRANSACTION_TYPES.income);
const isAssetAdjustment = computed(() => Boolean(props.transaction.isBalanceAdjustment));
const typeLabel = computed(() => {
  if (isAssetAdjustment.value) return t('transactions.readView.adjustment');
  if (props.transaction.transferNature === TRANSACTION_TRANSFER_NATURE.transfer_to_loan)
    return t('transactions.readView.loan');
  if (isTransfer.value) return t('transactions.readView.transfer');
  return t(isIncome.value ? 'transactions.readView.income' : 'transactions.readView.expense');
});
const date = computed(() => new Date(props.transaction.time));
const payer = computed(() => (props.transaction.payeeId ? payeeNames.value[props.transaction.payeeId] : undefined));
const heading = computed(
  () =>
    payer.value ||
    props.transaction.payeeNameSnapshot ||
    categoriesMap.value[props.transaction.categoryId]?.name ||
    typeLabel.value,
);
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
  <div class="flex min-h-0 flex-col" data-testid="transaction-read-view">
    <div class="border-border flex items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
      <p class="text-sm font-semibold" tabindex="-1" data-transaction-heading>
        {{ $t('transactions.list.detailsTitle') }}
      </p>
      <Button type="button" variant="ghost" size="icon" :aria-label="$t('common.ui.close')" @click="emit('close')">
        <XIcon class="size-4" aria-hidden="true" />
      </Button>
    </div>
    <div class="lajur-dialog-scroll min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <div class="space-y-1">
        <p class="text-muted-foreground text-sm">{{ typeLabel }}</p>
        <h3 class="text-lg font-semibold break-words">{{ heading }}</h3>
        <p
          class="text-2xl leading-tight font-semibold break-all tabular-nums"
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
          <span v-if="transaction.isPlanned || transaction.isPending">
            · {{ $t(transaction.isPlanned ? 'transactions.readView.planned' : 'transactions.readView.pending') }}</span
          >
        </p>
      </div>

      <dl
        v-if="ourAccount || otherAccount || paymentMethod || transaction.externalReference"
        class="bg-muted/40 divide-border/70 divide-y rounded-lg px-3"
      >
        <div v-if="isTransfer && (payerAccount || receiverAccount)" class="grid gap-2 py-3">
          <dt class="text-muted-foreground text-sm">{{ $t('transactions.readView.accounts') }}</dt>
          <dd class="flex flex-wrap items-center gap-2 text-sm">
            <span v-if="payerAccount"
              ><strong>{{ payerAccount }}</strong
              ><span v-if="accountAmounts"> · {{ accountAmounts[0] }}</span></span
            >
            <ArrowRightIcon
              v-if="payerAccount && receiverAccount"
              class="text-muted-foreground size-4"
              aria-hidden="true"
            />
            <span v-if="receiverAccount"
              ><strong>{{ receiverAccount }}</strong
              ><span v-if="accountAmounts"> · {{ accountAmounts[1] }}</span></span
            >
          </dd>
        </div>
        <div v-else-if="ourAccount" class="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
          <dt class="text-muted-foreground">{{ $t('transactions.table.columns.account') }}</dt>
          <dd>{{ ourAccount }}</dd>
        </div>
        <div v-if="paymentMethod" class="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
          <dt class="text-muted-foreground">{{ $t('transactions.readView.method') }}</dt>
          <dd>{{ $t(paymentMethod.label) }}</dd>
        </div>
        <div v-if="transaction.externalReference" class="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
          <dt class="text-muted-foreground">{{ $t('transactions.readView.reference') }}</dt>
          <dd class="break-all">{{ transaction.externalReference }}</dd>
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

      <div
        v-if="
          transaction.note ||
          transaction.tags?.length ||
          externalLink ||
          transaction.location ||
          transaction.originalAmount != null ||
          transaction.transactionGroups?.length
        "
        class="space-y-2 text-sm"
      >
        <p v-if="transaction.note" class="break-words whitespace-pre-wrap">{{ transaction.note }}</p>
        <div v-if="transaction.tags?.length" class="flex flex-wrap gap-1">
          <span v-for="tag in transaction.tags" :key="tag.id" class="bg-muted rounded-full px-2 py-1">{{
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
          class="max-w-full"
          @click="showAttachment(file)"
        >
          <PaperclipIcon class="size-4 shrink-0" aria-hidden="true" /><span class="truncate">{{ file.filename }}</span>
        </Button>
      </div>
      <Button v-else-if="attachmentError" type="button" variant="outline" size="sm" @click="retryAttachments">
        <PaperclipIcon class="size-4" aria-hidden="true" />{{ $t('common.actions.retry') }}
      </Button>
    </div>
    <div v-if="editable" class="border-border flex shrink-0 justify-end border-t px-4 py-3 sm:px-6">
      <Button type="button" class="min-h-11" @click="emit('edit')">
        <PencilIcon class="size-4" aria-hidden="true" />{{ $t('common.actions.edit') }}
      </Button>
    </div>
    <AttachmentViewerDialog v-if="activeAttachment" v-model:open="attachmentOpen" :attachment="activeAttachment" />
  </div>
</template>
