<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import CreateAccountForm from '@/components/forms/create-account-form.vue';
import { isMobileSheetOpen } from '@/composable/global-state/mobile-sheet';
import { trackAnalyticsEvent } from '@/lib/posthog';
import { ref, useId, watch } from 'vue';
import UiButton from '@/components/lib/ui/button/Button.vue';

const emit = defineEmits(['created']);

const isOpen = ref(false);
const formId = useId();
const formRef = ref<InstanceType<typeof CreateAccountForm> | null>(null);

watch(isOpen, (open) => {
  if (open) {
    trackAnalyticsEvent({ event: 'account_creation_opened' });
  }
});

const onAccountCreation = () => {
  isOpen.value = false;
  isMobileSheetOpen.value = false;
  emit('created');
};
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen">
    <template #trigger>
      <slot />
    </template>

    <template #title> {{ $t('common.dialogs.createAccount') }} </template>

    <CreateAccountForm ref="formRef" :form-id="formId" :show-submit-button="false" @created="onAccountCreation" />

    <template #footer>
      <UiButton type="submit" :form="formId" class="ml-auto min-w-30" :disabled="formRef?.isSubmitting">
        {{
          formRef?.isSubmitting ? $t('forms.createAccount.submitButtonLoading') : $t('forms.createAccount.submitButton')
        }}
      </UiButton>
    </template>
  </ResponsiveDialog>
</template>
