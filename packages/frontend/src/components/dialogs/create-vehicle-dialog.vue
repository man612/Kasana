<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import CreateVehicleForm from '@/components/forms/create-vehicle-form.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { isMobileSheetOpen } from '@/composable/global-state/mobile-sheet';
import { ref, useId } from 'vue';

const emit = defineEmits<{ created: [] }>();

const isOpen = ref(false);
const formId = useId();
const formRef = ref<InstanceType<typeof CreateVehicleForm> | null>(null);

const onCreated = () => {
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

    <template #title>{{ $t('common.dialogs.createVehicle') }}</template>

    <CreateVehicleForm ref="formRef" :form-id="formId" :show-submit-button="false" @created="onCreated" />
    <template #footer>
      <UiButton
        type="submit"
        :form="formId"
        class="ml-auto min-w-30"
        :disabled="formRef?.isSubmitting || formRef?.isSubmitDisabled !== false"
      >
        {{
          formRef?.isSubmitting ? $t('forms.createVehicle.submitButtonLoading') : $t('forms.createVehicle.submitButton')
        }}
      </UiButton>
    </template>
  </ResponsiveDialog>
</template>
