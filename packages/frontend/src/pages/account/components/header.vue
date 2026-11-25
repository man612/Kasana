<script setup lang="ts">
import { ACCOUNT_CATEGORIES_TRANSLATION_KEYS } from '@/common/const/account-categories-verbose';
import AccountLogo from '@/components/common/account-logo.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/common/dropdown-menu';
import PortfolioTransferDialog from '@/components/dialogs/portfolio-transfer-dialog.vue';
import ShareAccountDialog from '@/components/dialogs/share-account-dialog.vue';
import InputField from '@/components/fields/input-field.vue';
import { Button } from '@/components/lib/ui/button';
import { CardHeader } from '@/components/lib/ui/card';
import * as Popover from '@/components/lib/ui/popover';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import * as Tooltip from '@/components/lib/ui/tooltip';
import { useNotificationCenter } from '@/components/notification-center';
import { useFormValidation } from '@/composable';
import { useAccountAccess } from '@/composable/use-account-access';
import { useAccountProjectedBalance, usePlannedDateLabel } from '@/composable/use-projected-balance';
import { formatUIAmount } from '@/js/helpers';
import * as validators from '@/js/helpers/validators';
import { useAccountsStore, useCurrenciesStore } from '@/stores';
import { ACCOUNT_TYPES, AccountModel, SHARE_PERMISSIONS, TRANSACTIONS_WRITE_SCOPES } from '@bt/shared/types';
import { ArrowRightLeftIcon, MoreVerticalIcon, PencilIcon, ScaleIcon, Share2Icon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AccountLogoPicker from './account-logo-picker.vue';
import BalanceAdjustmentDialog from './balance-adjustment-dialog.vue';

const props = defineProps<{
  account: AccountModel;
}>();
const { baseCurrency } = storeToRefs(useCurrenciesStore());
const { displayBalance, displayRefBalance, projectedBalance, plannedCount, latestPlannedTime, hasPendingPlans } =
  useAccountProjectedBalance({ account: toRef(() => props.account) });
const accountsStore = useAccountsStore();
const formEditingPopoverOpen = ref(false);
const adjustmentDialogOpen = ref(false);
const shareDialogOpen = ref(false);
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const { t } = useI18n();

const isSystemAccount = computed(() => props.account.type === ACCOUNT_TYPES.system);

const { formatPlannedDate } = usePlannedDateLabel();

const projectedBalanceDisplay = computed(() =>
  formatUIAmount(projectedBalance.value, { currency: props.account.currencyCode }),
);
const latestPlannedDisplay = computed(() => formatPlannedDate({ time: latestPlannedTime.value }));
const { isOwner, isSharedWithCaller, ownerHandle, permission, writeScope, isHouseholdGranted } = useAccountAccess(
  toRef(() => props.account),
);

const permissionBadgeLabel = computed(() => {
  if (!isSharedWithCaller.value) return null;
  if (permission.value === SHARE_PERMISSIONS.manage) return t('pages.account.header.shareBadge.manage');
  if (permission.value === SHARE_PERMISSIONS.write) {
    return writeScope.value === TRANSACTIONS_WRITE_SCOPES.own
      ? t('pages.account.header.shareBadge.writeOwn')
      : t('pages.account.header.shareBadge.writeAll');
  }
  return t('pages.account.header.shareBadge.read');
});

const accountNameForm = ref({
  name: props.account.name,
});
const { isFormValid, touchField, getFieldErrorMessage, resetValidation } = useFormValidation(
  { form: accountNameForm },
  {
    form: {
      name: {
        required: validators.required,
        minLength: validators.minLength(2),
      },
    },
  },
);

const updateAccount = async () => {
  if (!isFormValid()) return;

  try {
    await accountsStore.editAccount({
      id: props.account.id,
      name: accountNameForm.value.name,
    });

    formEditingPopoverOpen.value = false;
    addSuccessNotification(t('pages.account.header.updateSuccess'));
  } catch {
    addErrorNotification(t('pages.account.header.updateError'));
  }
};

// Reset form when popover opens or when account changes
watch([formEditingPopoverOpen, () => props.account.id], () => {
  accountNameForm.value.name = props.account.name;
  resetValidation();
});
</script>

<template>
  <CardHeader class="@container/account-hero gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-4">
    <div class="flex min-w-0 items-start gap-3">
      <AccountLogoPicker v-if="isOwner" :account-id="account.id" class="size-10 shrink-0" />
      <AccountLogo v-else :account="account" class="size-10 shrink-0" />
      <div class="min-w-0 flex-1">
        <h1
          :title="account.name"
          class="line-clamp-2 text-base leading-tight font-semibold tracking-tight wrap-anywhere sm:text-xl"
        >
          {{ account.name }}
        </h1>
        <p class="text-muted-foreground mt-0.5 text-sm">
          {{ $t(ACCOUNT_CATEGORIES_TRANSLATION_KEYS[account.accountCategory]) }}
        </p>
      </div>
      <DropdownMenu v-if="isOwner">
        <DropdownMenuTrigger as-child>
          <Button type="button" variant="ghost" size="icon" :aria-label="$t('pages.account.header.accountActions')">
            <MoreVerticalIcon class="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Tooltip.TooltipProvider>
            <Tooltip.Tooltip :delay-duration="0">
              <Tooltip.TooltipTrigger as-child>
                <span class="block">
                  <DropdownMenuItem
                    class="gap-2"
                    :disabled="!isSystemAccount"
                    :class="!isSystemAccount ? 'pointer-events-none' : ''"
                    @select="isSystemAccount && (adjustmentDialogOpen = true)"
                  >
                    <ScaleIcon class="size-4" aria-hidden="true" />
                    {{ $t('pages.account.header.adjustBalance') }}
                  </DropdownMenuItem>
                </span>
              </Tooltip.TooltipTrigger>
              <Tooltip.TooltipContent v-if="!isSystemAccount">
                {{ $t('pages.account.header.adjustBalanceTooltip') }}
              </Tooltip.TooltipContent>
            </Tooltip.Tooltip>
          </Tooltip.TooltipProvider>
          <DropdownMenuItem class="gap-2" @select="shareDialogOpen = true">
            <Share2Icon class="size-4" aria-hidden="true" />
            {{ $t('pages.account.header.share') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div
      v-if="isSharedWithCaller && ownerHandle"
      class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
    >
      <span v-if="isHouseholdGranted">{{ $t('accounts.viaHousehold', { handle: `@${ownerHandle}` }) }}</span>
      <span v-else>{{ $t('accounts.sharedBy', { handle: `@${ownerHandle}` }) }}</span>
      <span
        v-if="permissionBadgeLabel"
        class="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium"
      >
        {{ permissionBadgeLabel }}
      </span>
    </div>

    <div class="border-border/65 flex flex-wrap items-end justify-between gap-x-2 gap-y-1.5 border-t pt-2">
      <div class="min-w-0 grow">
        <p class="text-muted-foreground text-xs">{{ $t('accounts.overview.totalBalance') }}</p>
        <component
          :is="isSystemAccount && isOwner ? Button : 'div'"
          :variant="isSystemAccount && isOwner ? 'ghost' : undefined"
          :aria-label="
            isSystemAccount && isOwner
              ? `${t('pages.account.header.adjustBalance')}: ${formatUIAmount(displayBalance, { currency: account.currencyCode })}`
              : undefined
          "
          class="flex h-auto max-w-full min-w-0 flex-wrap items-baseline justify-start gap-x-2 px-0 text-start whitespace-normal"
          @click="isSystemAccount && isOwner && (adjustmentDialogOpen = true)"
        >
          <Transition name="kasana-page">
            <span
              :key="displayBalance"
              class="text-amount min-w-0 text-2xl leading-tight wrap-anywhere tabular-nums @sm/account-hero:text-4xl"
              :class="displayBalance < 0 && 'text-destructive-text'"
            >
              {{ formatUIAmount(displayBalance, { currency: account.currencyCode }) }}
            </span>
          </Transition>
          <span
            v-if="baseCurrency && account.currencyCode !== baseCurrency.currencyCode"
            class="text-muted-foreground min-w-0 text-sm wrap-anywhere tabular-nums"
          >
            ≈ {{ formatUIAmount(displayRefBalance, { currency: baseCurrency.currencyCode }) }}
          </span>
        </component>

        <i18n-t
          v-if="hasPendingPlans"
          keypath="pages.account.header.projectedBalance"
          :plural="plannedCount"
          tag="div"
          class="text-muted-foreground mt-1 text-sm"
        >
          <template #amount>
            <span class="text-amount text-foreground">{{ projectedBalanceDisplay }}</span>
          </template>
          <template #count>{{ plannedCount }}</template>
          <template #date>{{ latestPlannedDisplay }}</template>
        </i18n-t>
      </div>

      <div v-if="isOwner" class="flex flex-wrap items-center gap-2">
        <Popover.Popover v-model:open="formEditingPopoverOpen">
          <Popover.PopoverTrigger as-child>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="min-h-10"
              :aria-label="`${t('pages.account.header.editAccountName')}: ${account.name}`"
            >
              <PencilIcon class="size-4" aria-hidden="true" />
              {{ $t('common.actions.edit') }}
            </Button>
          </Popover.PopoverTrigger>
          <Popover.PopoverContent dim-backdrop align="end">
            <form class="grid gap-3" @submit.prevent="updateAccount">
              <InputField
                v-model="accountNameForm.name"
                :label="$t('pages.account.header.nameLabel')"
                :placeholder="$t('pages.account.header.namePlaceholder')"
                :error-message="getFieldErrorMessage('form.name')"
                @blur="touchField('form.name')"
              />
              <Button type="submit" :disabled="accountNameForm.name === account.name || !accountNameForm.name.trim()">
                {{ $t('pages.account.header.save') }}
              </Button>
            </form>
          </Popover.PopoverContent>
        </Popover.Popover>
        <DesktopOnlyTooltip :content="$t('pages.account.header.transferToPortfolio')">
          <span class="inline-flex">
            <PortfolioTransferDialog :account="account" context="account">
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="size-10"
                :aria-label="$t('pages.account.header.transferToPortfolio')"
              >
                <ArrowRightLeftIcon class="size-4" aria-hidden="true" />
              </Button>
            </PortfolioTransferDialog>
          </span>
        </DesktopOnlyTooltip>
      </div>
    </div>

    <BalanceAdjustmentDialog v-if="adjustmentDialogOpen" :account="account" @close="adjustmentDialogOpen = false" />
    <ShareAccountDialog v-model:open="shareDialogOpen" :account="account" />
  </CardHeader>
</template>
