<template>
  <template v-if="accounts.length || account || isMobile">
    <form-row data-testid="transaction-account-section">
      <AccountSelectField
        data-test="account-select-field"
        allow-create
        :label="
          $t(
            hasTransferDestination
              ? 'dialogs.manageTransaction.form.fromAccountLabel'
              : 'dialogs.manageTransaction.form.accountLabel',
          )
        "
        :hide-label="hideAccountHeading"
        :placeholder="$t('dialogs.manageTransaction.form.selectAccountPlaceholder')"
        :accounts="accounts"
        :include-out-of-wallet="hasTransferDestination"
        :disabled="disabled || fromAccountDisabled"
        :model-value="account"
        @update:model-value="updateFormAccount"
      >
        <template
          v-if="
            !hasTransferDestination &&
            ($slots['account-label-pill'] || ($slots['account-label-right'] && !$slots['account-field-right']))
          "
          #label-right
        >
          <div class="flex items-center gap-2">
            <slot name="account-label-pill" />
            <slot v-if="!$slots['account-field-right']" name="account-label-right" />
          </div>
        </template>
        <template v-if="!hasTransferDestination && $slots['account-field-right']" #field-right>
          <slot name="account-field-right" />
        </template>
        <template #select-bottom-content>
          <CreateAccountDialog>
            <UiButton type="button" class="w-full justify-start" variant="ghost-primary" size="sm">
              <PlusIcon class="size-4" />
              {{ $t('dialogs.manageTransaction.form.addNewAccountButton') }}
            </UiButton>
          </CreateAccountDialog>
        </template>
      </AccountSelectField>

      <Transition name="lajur-flow-row">
        <div v-if="hasTransferDestination && account?.id === OUT_OF_WALLET_ACCOUNT_MOCK.id" class="lajur-flow-row">
          <div>
            <UiButton type="button" variant="link" size="sm" class="px-1" @click="isOutOfWalletHelpOpen = true">
              {{ $t('dialogs.manageTransaction.form.outOfWalletDocsLink') }}
            </UiButton>
          </div>
        </div>
      </Transition>
      <slot v-if="!hasTransferDestination" name="account-hint" />
    </form-row>
    <Transition name="lajur-flow-row">
      <div v-if="hasTransferDestination" class="lajur-flow-row">
        <div>
          <form-row>
            <DestinationPanel :label="$t('dialogs.manageTransaction.form.destinationGroupLabel')">
              <form-row class="bg-dialog sticky top-0 z-5 pb-1">
                <PillTabs
                  :model-value="destinationType"
                  :items="destinationTypeItems"
                  size="sm"
                  :disabled="disabled || toAccountDisabled || destinationTypeDisabled"
                  class="w-full"
                  @update:model-value="updateDestinationType"
                />
              </form-row>

              <Transition name="lajur-flow-row">
                <div v-if="destinationType === 'account'" class="lajur-flow-row">
                  <div>
                    <form-row>
                      <div
                        class="grid min-w-0 grid-cols-1 items-end gap-2"
                        :class="showTargetAmount && 'sm:grid-cols-2'"
                      >
                        <AccountSelectField
                          allow-create
                          :label="$t('dialogs.manageTransaction.form.toAccountLabel')"
                          :placeholder="$t('dialogs.manageTransaction.form.selectAccountPlaceholder')"
                          :accounts="filteredAccounts"
                          :include-out-of-wallet="account?.id !== OUT_OF_WALLET_ACCOUNT_MOCK.id"
                          :disabled="disabled || toAccountDisabled"
                          :model-value="toAccount"
                          @update:model-value="updateToAccount"
                        >
                          <template #label-right>
                            <Transition name="lajur-form-panel">
                              <button
                                v-if="toAccount?.id === OUT_OF_WALLET_ACCOUNT_MOCK.id"
                                type="button"
                                class="text-primary text-xs hover:underline"
                                @click="isOutOfWalletHelpOpen = true"
                              >
                                {{ $t('dialogs.manageTransaction.form.outOfWalletDocsLink') }}
                              </button>
                            </Transition>
                          </template>
                          <template #select-bottom-content>
                            <CreateAccountDialog>
                              <UiButton type="button" class="w-full justify-start" variant="ghost-primary" size="sm">
                                <PlusIcon class="size-4" />
                                {{ $t('dialogs.manageTransaction.form.addNewAccountButton') }}
                              </UiButton>
                            </CreateAccountDialog>
                          </template>
                        </AccountSelectField>
                        <slot name="account-target-amount" />
                      </div>
                    </form-row>
                  </div>
                </div>
              </Transition>
              <Transition name="lajur-flow-row">
                <div v-if="destinationType === 'portfolio'" class="lajur-flow-row">
                  <div>
                    <form-row>
                      <select-field
                        :label="$t('dialogs.manageTransaction.form.toPortfolioLabel')"
                        :placeholder="
                          portfolios.length
                            ? $t('dialogs.manageTransaction.form.selectPortfolioPlaceholder')
                            : $t('dialogs.manageTransaction.form.noPortfoliosExist')
                        "
                        :values="portfolios"
                        label-key="name"
                        value-key="id"
                        with-search
                        :disabled="disabled || toAccountDisabled || !portfolios.length"
                        :model-value="toPortfolio"
                        @update:model-value="updateToPortfolio"
                      />
                    </form-row>
                  </div>
                </div>
              </Transition>
              <Transition name="lajur-flow-row">
                <div v-if="destinationType === 'loan'" class="lajur-flow-row">
                  <div>
                    <form-row>
                      <AccountSelectField
                        :label="$t('dialogs.manageTransaction.form.toLoanLabel')"
                        :placeholder="
                          loanAccounts.length
                            ? $t('dialogs.manageTransaction.form.selectLoanPlaceholder')
                            : $t('dialogs.manageTransaction.form.noLoansExist')
                        "
                        :accounts="loanAccounts"
                        :disabled="disabled || toAccountDisabled || !loanAccounts.length"
                        :model-value="toAccount"
                        @update:model-value="updateToAccount"
                      />
                    </form-row>
                  </div>
                </div>
              </Transition>

              <slot name="destination-bottom" />
            </DestinationPanel>
          </form-row>
        </div>
      </div>
    </Transition>
  </template>
  <template v-else>
    <form-row data-testid="transaction-account-section">
      <input-field
        :model-value="$t('dialogs.manageTransaction.form.noAccountExists')"
        :label="$t('dialogs.manageTransaction.form.accountLabel')"
        readonly
        non-label-wrapper
        :disabled="disabled"
      >
        <template #label-right>
          <div class="flex items-center gap-3">
            <slot name="account-label-right" />
            <CreateAccountDialog>
              <div class="text-primary-text cursor-pointer hover:underline">
                {{ $t('dialogs.manageTransaction.form.createAccountLink') }}
              </div>
            </CreateAccountDialog>
          </div>
        </template>
      </input-field>
      <slot name="account-hint" />
    </form-row>
  </template>
  <ResponsiveDialog v-model:open="isOutOfWalletHelpOpen" raised mobile-presentation="center">
    <template #title>{{ $t('dialogs.manageTransaction.form.outOfWalletHelpTitle') }}</template>
    <template #description>{{ $t('dialogs.manageTransaction.form.outOfWalletHelpDescription') }}</template>
    <p class="text-muted-foreground px-1 pb-2 text-sm leading-relaxed">
      {{ $t('dialogs.manageTransaction.form.outOfWalletHelpExample') }}
    </p>
  </ResponsiveDialog>
</template>

<script setup lang="ts">
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import CreateAccountDialog from '@/components/dialogs/create-account-dialog.vue';
import AccountSelectField from '@/components/fields/account-select-field.vue';
import InputField from '@/components/fields/input-field.vue';
import SelectField from '@/components/fields/select-field.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { PillTabs } from '@/components/lib/ui/pill-tabs';
import { OUT_OF_WALLET_ACCOUNT_MOCK } from '@/common/const';
import { AccountModel, PortfolioModel, TRANSACTION_TYPES } from '@bt/shared/types';
import { BriefcaseIcon, HandCoinsIcon, PlusIcon, WalletIcon } from '@lucide/vue';
import { type Component, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getAvailableTransferDestinationTypes } from '../helpers';
import type { TransferDestinationType } from '../composables/transfer-form';
import DestinationPanel from './destination-panel.vue';
import FormRow from './form-row.vue';

const { t } = useI18n();

const isOutOfWalletHelpOpen = ref(false);

const DESTINATION_TYPE_META: Record<TransferDestinationType, { labelKey: string; icon: Component }> = {
  account: { labelKey: 'dialogs.manageTransaction.form.destinationTypeAccount', icon: WalletIcon },
  portfolio: { labelKey: 'dialogs.manageTransaction.form.destinationTypePortfolio', icon: BriefcaseIcon },
  loan: { labelKey: 'dialogs.manageTransaction.form.destinationTypeLoan', icon: HandCoinsIcon },
};

const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);

const props = withDefaults(
  defineProps<{
    account?: AccountModel | null;
    toAccount?: AccountModel | null;
    toPortfolio?: PortfolioModel | null;
    destinationType?: TransferDestinationType;
    portfolios?: PortfolioModel[];
    loanAccounts?: AccountModel[];
    isTransferTransaction: boolean;
    accounts: AccountModel[];
    filteredAccounts: AccountModel[];
    isTransactionLinking?: boolean;
    transactionType: TRANSACTION_TYPES;
    fromAccountDisabled?: boolean;
    toAccountDisabled?: boolean;
    /** Locks the destination-type pills while keeping the pickers themselves usable. */
    destinationTypeDisabled?: boolean;
    showTargetAmount?: boolean;
    hideAccountHeading?: boolean;
    disabled?: boolean;
  }>(),
  {
    account: null,
    toAccount: null,
    toPortfolio: null,
    destinationType: 'account',
    portfolios: () => [],
    loanAccounts: () => [],
    isTransactionLinking: false,
    fromAccountDisabled: false,
    toAccountDisabled: false,
    destinationTypeDisabled: false,
  },
);

const hasTransferDestination = computed(() => props.isTransferTransaction && !props.isTransactionLinking);

const destinationTypeItems = computed(() =>
  getAvailableTransferDestinationTypes(props.transactionType).map((value) => ({
    value,
    label: t(DESTINATION_TYPE_META[value].labelKey),
    icon: DESTINATION_TYPE_META[value].icon,
  })),
);

const emit = defineEmits<{
  'update:account': [account: AccountModel | null];
  'update:to-account': [account: AccountModel | null];
  'update:to-portfolio': [portfolio: PortfolioModel | null];
  'update:destination-type': [type: TransferDestinationType];
}>();

const updateFormAccount = (account: AccountModel | null) => {
  emit('update:account', account);
};

const updateToAccount = (account: AccountModel | null) => {
  emit('update:to-account', account);
};

const updateToPortfolio = (portfolio: PortfolioModel | null) => {
  emit('update:to-portfolio', portfolio);
};

const updateDestinationType = (type: string) => {
  emit('update:destination-type', type as TransferDestinationType);
};
</script>
