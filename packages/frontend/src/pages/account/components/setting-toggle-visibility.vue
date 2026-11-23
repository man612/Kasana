<script setup lang="ts">
import { Switch } from '@/components/lib/ui/switch';
import HintIcon from '@/components/common/hint-icon.vue';
import { useNotificationCenter } from '@/components/notification-center';
import { useAccountAccess } from '@/composable/use-account-access';
import { useAccountsStore } from '@/stores';
import { AccountModel } from '@bt/shared/types';
import { debounce } from 'lodash-es';
import { reactive, toRef, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  account: AccountModel;
}>();

const { isOwner } = useAccountAccess(toRef(() => props.account));

const { addSuccessNotification, addErrorNotification } = useNotificationCenter();
const accountsStore = useAccountsStore();

const form = reactive({
  excludeFromStats: false,
});

const updateExcludeFromStats = async ({ id, excludeFromStats }: { id: string; excludeFromStats: boolean }) => {
  try {
    await accountsStore.editAccount({ id, excludeFromStats });

    addSuccessNotification(t('pages.account.visibility.updateSuccess'));
  } catch {
    addErrorNotification(t('pages.account.visibility.unexpectedError'));
    form.excludeFromStats = !form.excludeFromStats;
  }
};

const debouncedHandler = debounce(updateExcludeFromStats, 1000);

watchEffect(() => {
  if (props.account) {
    form.excludeFromStats = props.account.excludeFromStats;
  }
});

watch(
  () => form.excludeFromStats,
  (value) => {
    if (value !== props.account.excludeFromStats) {
      debouncedHandler({
        id: props.account.id,
        excludeFromStats: value,
      });
    }
  },
);
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <span class="flex items-center gap-2">
      {{ t('pages.account.excludeFromStats.label') }}

      <HintIcon
        :title="$t('pages.account.excludeFromStats.label')"
        :example="isOwner ? $t('pages.account.excludeFromStats.example') : undefined"
        :content="
          isOwner ? t('pages.account.excludeFromStats.tooltip') : t('pages.account.excludeFromStats.recipientTooltip')
        "
      />
    </span>

    <Switch v-model:model-value="form.excludeFromStats" :disabled="!isOwner" />
  </div>
</template>
