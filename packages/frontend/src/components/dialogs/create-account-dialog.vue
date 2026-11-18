<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import CreateAccountForm from '@/components/forms/create-account-form.vue';
import { isMobileSheetOpen } from '@/composable/global-state/mobile-sheet';
import { trackAnalyticsEvent } from '@/lib/posthog';
import { computed, ref, useId, watch } from 'vue';
import UiButton from '@/components/lib/ui/button/Button.vue';

const props = defineProps<{ open?: boolean }>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  created: [];
}>();

const localOpen = ref(false);
const isOpen = computed({
  get: () => props.open ?? localOpen.value,
  set: (open: boolean) => {
    localOpen.value = open;
    emit('update:open', open);
  },
});
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
  <ResponsiveDialog v-model:open="isOpen" custom-close>
    <template v-if="$slots.default" #trigger>
      <slot />
    </template>

    <template #title> {{ $t('common.dialogs.createAccount') }} </template>

    <CreateAccountForm ref="formRef" :form-id="formId" :show-submit-button="false" @created="onAccountCreation" />

    <template #footer="{ close }">
      <UiButton type="button" variant="outline" class="min-h-11 min-w-0" @click="close()">
        {{ $t('common.actions.cancel') }}
      </UiButton>
      <UiButton type="submit" :form="formId" class="min-h-11 min-w-0" :disabled="formRef?.isSubmitting">
        {{
          formRef?.isSubmitting ? $t('forms.createAccount.submitButtonLoading') : $t('forms.createAccount.submitButton')
        }}
      </UiButton>
    </template>
  </ResponsiveDialog>
</template>
