<script setup lang="ts">
import {
  ACCOUNT_CATEGORIES_TRANSLATION_KEYS,
  NO_PAYMENT_TYPE_OPTION,
  NULLABLE_PAYMENT_TYPE_OPTIONS,
} from '@/common/const';
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import { Button } from '@/components/lib/ui/button';
import { Card } from '@/components/lib/ui/card';
import * as Tabs from '@/components/lib/ui/tabs';
import { useAccountAccess } from '@/composable/use-account-access';
import { useAccountCurrencyCode } from '@/composable/use-account-currency-code';
import { formatUIAmount } from '@/js/helpers';
import { useCurrenciesStore } from '@/stores';
import { ACCOUNT_TYPES, AccountModel, isDedicatedFlowAccountCategory } from '@bt/shared/types';
import { ChevronDownIcon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, ref, toRef, useId } from 'vue';

const CreditLimitEditPopover = defineAsyncComponent(() => import('./credit-limit-edit-popover.vue'));
const InitialBalanceEditPopover = defineAsyncComponent(() => import('./initial-balance-edit-popover.vue'));
const AccountCategoryEditPopover = defineAsyncComponent(() => import('./account-category-edit-popover.vue'));
const AccountDefaultPaymentTypeEditPopover = defineAsyncComponent(
  () => import('./account-default-payment-type-edit-popover.vue'),
);

const props = defineProps<{
  account: AccountModel;
  tabName: string;
}>();

const { currenciesMap } = storeToRefs(useCurrenciesStore());
const isOpen = ref(false);
const currencyDetailsId = useId();

const currencyCode = useAccountCurrencyCode({ account: toRef(() => props.account) });
const { isOwner } = useAccountAccess(toRef(() => props.account));
// Loan and vehicle categories are locked to their dedicated flows on the backend.
const isCategoryEditable = computed(
  () => isOwner.value && !isDedicatedFlowAccountCategory(props.account.accountCategory),
);
const defaultPaymentTypeLabelKey = computed(
  () =>
    (
      NULLABLE_PAYMENT_TYPE_OPTIONS.find((option) => option.value === (props.account.defaultPaymentType ?? null)) ??
      NO_PAYMENT_TYPE_OPTION
    ).label,
);
const isInitialBalanceEditable = computed(
  () => isCategoryEditable.value && props.account.type === ACCOUNT_TYPES.system,
);
</script>

<template>
  <Tabs.TabsContent :value="tabName">
    <div class="@container/account-details grid min-w-0 gap-3 text-sm">
      <div class="grid min-w-0 items-start gap-3 @2xl/account-details:grid-cols-2">
        <Card>
          <dl class="divide-border/60 divide-y px-3">
            <div class="grid min-h-12 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-2 py-2">
              <dt class="text-muted-foreground wrap-anywhere">{{ $t('pages.account.details.initialBalance') }}</dt>
              <dd
                class="flex min-w-0 items-center justify-end gap-1.5 text-right font-medium wrap-anywhere tabular-nums [&>button]:shrink-0"
              >
                <span>{{ formatUIAmount(account.initialBalance, { currency: currencyCode }) }}</span>
                <InitialBalanceEditPopover
                  v-if="isInitialBalanceEditable"
                  :account="account"
                  :currency-code="currencyCode"
                />
              </dd>
            </div>
            <div class="grid min-h-12 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-2 py-2">
              <dt class="text-muted-foreground wrap-anywhere">{{ $t('pages.account.details.creditLimit') }}</dt>
              <dd
                class="flex min-w-0 items-center justify-end gap-1.5 text-right font-medium wrap-anywhere tabular-nums [&>button]:shrink-0"
              >
                <span>{{ formatUIAmount(account.creditLimit, { currency: currencyCode }) }}</span>
                <CreditLimitEditPopover v-if="isOwner" :account="account" :currency-code="currencyCode" />
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <dl class="divide-border/60 divide-y px-3">
            <div class="grid min-h-12 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-2 py-2">
              <dt class="text-muted-foreground wrap-anywhere">{{ $t('pages.account.details.accountCategory') }}</dt>
              <dd
                class="flex min-w-0 items-center justify-end gap-1.5 text-right font-medium wrap-anywhere [&>button]:shrink-0"
              >
                <span>{{ $t(ACCOUNT_CATEGORIES_TRANSLATION_KEYS[account.accountCategory]) }}</span>
                <AccountCategoryEditPopover v-if="isCategoryEditable" :account="account" />
              </dd>
            </div>
            <div class="grid min-h-12 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-2 py-2">
              <dt class="text-muted-foreground wrap-anywhere">{{ $t('pages.account.details.defaultPaymentType') }}</dt>
              <dd
                class="flex min-w-0 items-center justify-end gap-1.5 text-right font-medium wrap-anywhere [&>button]:shrink-0"
              >
                <span>{{ $t(defaultPaymentTypeLabelKey) }}</span>
                <AccountDefaultPaymentTypeEditPopover v-if="isOwner" :account="account" />
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card class="px-3">
        <Button
          type="button"
          variant="ghost"
          class="min-h-12 w-full flex-wrap justify-between px-0 text-left whitespace-normal"
          :aria-expanded="isOpen"
          :aria-controls="currencyDetailsId"
          @click="isOpen = !isOpen"
        >
          <span>{{ $t('pages.account.details.currency') }}</span>
          <span class="text-muted-foreground flex min-w-0 items-center gap-1.5 text-right wrap-anywhere">
            {{ currencyCode }}
            <span v-if="currenciesMap[account.currencyCode]?.isDefaultCurrency">{{
              $t('pages.account.details.main')
            }}</span>
            <ChevronDownIcon
              class="size-4 shrink-0 motion-safe:transition-transform"
              :class="isOpen && 'rotate-180'"
              aria-hidden="true"
            />
          </span>
        </Button>
        <LayoutCollapse :id="currencyDetailsId" :open="isOpen">
          <dl class="border-border/60 divide-border/60 divide-y border-t">
            <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-2 py-2.5">
              <dt class="text-muted-foreground">{{ $t('pages.account.details.exchangeRate') }}</dt>
              <dd class="text-right wrap-anywhere tabular-nums">
                {{ currenciesMap[account.currencyCode]?.exchangeRate }}
              </dd>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-2 py-2.5">
              <dt class="text-muted-foreground">{{ $t('pages.account.details.exchangeRateLiveUpdate') }}</dt>
              <dd class="text-right">
                {{
                  $t(
                    currenciesMap[account.currencyCode]?.liveRateUpdate
                      ? 'pages.account.details.enabled'
                      : 'pages.account.details.disabled',
                  )
                }}
              </dd>
            </div>
          </dl>
        </LayoutCollapse>
      </Card>
    </div>
  </Tabs.TabsContent>
</template>
