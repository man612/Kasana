<script setup lang="ts">
import UiButton from '@/components/lib/ui/button/Button.vue';
import ResponsiveDialog from '@/components/common/responsive-dialog.vue';
import PortfolioSettingsForm from '@/components/forms/portfolio-settings-form.vue';
import type { PortfolioModel } from '@bt/shared/types/investments';
import { ref, useId, useTemplateRef } from 'vue';

interface Emit {
  (e: 'updated'): void;
}

defineProps<{ portfolio: PortfolioModel }>();
const emit = defineEmits<Emit>();

const isOpen = ref(false);

const handleUpdated = () => {
  isOpen.value = false;
  emit('updated');
};
const formId = useId();
const actionForm = useTemplateRef<InstanceType<typeof PortfolioSettingsForm>>('action-form');
</script>

<template>
  <ResponsiveDialog v-model:open="isOpen" custom-close centered-title fit-keyboard>
    <template #trigger>
      <slot />
    </template>

    <template #title>{{ $t('dialogs.editPortfolio.title') }}</template>

    <PortfolioSettingsForm
      ref="action-form"
      :form-id="formId"
      :portfolio="portfolio"
      @updated="handleUpdated"
      @cancel="isOpen = false"
    />
    <template #footer>
      <UiButton type="button" variant="secondary" :disabled="actionForm?.isSubmitting" @click="isOpen = false">
        {{ $t('forms.portfolioSettings.cancelButton') }}
      </UiButton>
      <UiButton type="submit" :form="formId" :disabled="actionForm?.isSubmitDisabled ?? true">
        {{
          actionForm?.isSubmitting
            ? $t('forms.portfolioSettings.submitButtonLoading')
            : $t('forms.portfolioSettings.submitButton')
        }}
      </UiButton>
    </template>
  </ResponsiveDialog>
</template>
