<script setup lang="ts">
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import CreateVehicleForm from '@/components/forms/create-vehicle-form.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { isMobileSheetOpen } from '@/composable/global-state/mobile-sheet';
import { computed, ref, useId } from 'vue';

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
const formRef = ref<InstanceType<typeof CreateVehicleForm> | null>(null);

const onCreated = () => {
  isOpen.value = false;
  isMobileSheetOpen.value = false;
  emit('created');
};
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen" fit-keyboard custom-close>
    <template v-if="$slots.default" #trigger>
      <slot />
    </template>

    <template #title>{{ $t('common.dialogs.createVehicle') }}</template>

    <CreateVehicleForm ref="formRef" :form-id="formId" :show-submit-button="false" @created="onCreated" />
    <template #footer="{ close }">
      <UiButton type="button" variant="outline" class="min-h-11 min-w-0" @click="close()">
        {{ $t('common.actions.cancel') }}
      </UiButton>
      <UiButton
        type="submit"
        :form="formId"
        class="min-h-11 min-w-0"
        :disabled="formRef?.isSubmitting || formRef?.isSubmitDisabled !== false"
      >
        {{
          formRef?.isSubmitting ? $t('forms.createVehicle.submitButtonLoading') : $t('forms.createVehicle.submitButton')
        }}
      </UiButton>
    </template>
  </ResponsiveDialog>
</template>
