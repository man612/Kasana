<script setup lang="ts">
import type { VehicleModel } from '@/api/vehicles';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import { ref, useId } from 'vue';
import EditVehicleForm from '@/components/forms/edit-vehicle-form.vue';
import { isMobileSheetOpen } from '@/composable/global-state/mobile-sheet';

defineProps<{ vehicle: VehicleModel }>();
const open = defineModel<boolean>('open', { default: false });
const formId = useId();
const form = ref<InstanceType<typeof EditVehicleForm> | null>(null);

const onUpdated = () => {
  open.value = false;
  isMobileSheetOpen.value = false;
};
</script>

<template>
  <ResponsiveDialog v-model:open="open" fit-keyboard custom-close>
    <template #title>{{ $t('common.dialogs.editVehicle') }}</template>
    <EditVehicleForm ref="form" :form-id="formId" :vehicle="vehicle" @updated="onUpdated" />
    <template #footer="{ close }">
      <Button type="button" variant="outline" class="min-h-11 min-w-0" @click="close">
        {{ $t('common.actions.cancel') }}
      </Button>
      <Button
        type="submit"
        :form="formId"
        class="min-h-11 min-w-0"
        :disabled="form?.isSubmitDisabled !== false || form.isSaving"
        :loading="form?.isSaving"
      >
        {{ $t(form?.isSaving ? 'forms.editVehicle.submitButtonLoading' : 'forms.editVehicle.submitButton') }}
      </Button>
    </template>
  </ResponsiveDialog>
</template>
