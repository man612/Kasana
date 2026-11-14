<script setup lang="ts">
import { updateVehicle, type VehicleModel } from '@/api/vehicles';
import { VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const';
import { DEPRECIATION_PRESET_TRANSLATION_KEYS } from '@/common/const/vehicle-classes-verbose';
import InputField from '@/components/fields/input-field.vue';
import FormFieldHelp from '@/components/common/form-field-help.vue';
import OptionPickerDialog from '@/components/fields/option-picker-dialog.vue';
import SelectField from '@/components/fields/select-field.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useFormValidation } from '@/composable/form-validator';
import { captureException } from '@/lib/sentry';
import { DEPRECIATION_PRESET, VEHICLE_CLASS } from '@bt/shared/types';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { between, helpers, integer, maxValue, minValue, required, requiredIf } from '@vuelidate/validators';
import { computed, reactive } from 'vue';
import { buildVehicleClassOptions } from './vehicle-class-options';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ vehicle: VehicleModel }>();
const emit = defineEmits<{ updated: [] }>();

const { t } = useI18n();
const queryClient = useQueryClient();
const { addNotification } = useNotificationCenter();

interface FormState {
  name: string;
  make: string;
  model: string;
  trim: string;
  year: number | null;
  vehicleClass: VEHICLE_CLASS;
  depreciationPreset: DEPRECIATION_PRESET;
  customAnnualRatePct: number | null;
  salvageFloorPct: number;
  currentMileage: number | null;
}

const form = reactive<FormState>({
  name: props.vehicle.account?.name ?? `${props.vehicle.make} ${props.vehicle.model}`,
  make: props.vehicle.make,
  model: props.vehicle.model,
  trim: props.vehicle.trim ?? '',
  year: props.vehicle.year,
  vehicleClass: props.vehicle.vehicleClass,
  depreciationPreset: props.vehicle.depreciationPreset,
  customAnnualRatePct: props.vehicle.customAnnualRatePct,
  salvageFloorPct: props.vehicle.salvageFloorPct,
  currentMileage: props.vehicle.currentMileage,
});

const vehicleClassOptions = computed(() => buildVehicleClassOptions((key) => t(key)));

const depreciationPresetOptions = computed(() =>
  Object.values(DEPRECIATION_PRESET).map((value) => ({
    label: t(DEPRECIATION_PRESET_TRANSLATION_KEYS[value]),
    value,
  })),
);

const selectedDepreciationPreset = computed(
  () => depreciationPresetOptions.value.find((o) => o.value === form.depreciationPreset) ?? null,
);

const showCustomRate = computed(() => form.depreciationPreset === DEPRECIATION_PRESET.custom);

const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear() + 1;
const MAX_MILEAGE = 10_000_000;

const vehicleYearInput = computed({
  get: () => form.year?.toString() ?? '',
  set: (value: string | number | null) => {
    const digits = String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 4);
    form.year = digits ? Number(digits) : null;
  },
});

const validationRules = {
  name: { required },
  make: { required },
  model: { required },
  year: {
    required,
    integer,
    between: helpers.withMessage(
      () => t('forms.createVehicle.errors.yearRange', { min: MIN_YEAR, max: MAX_YEAR }),
      between(MIN_YEAR, MAX_YEAR),
    ),
  },
  vehicleClass: { required },
  salvageFloorPct: {
    required,
    between: helpers.withMessage(() => t('forms.createVehicle.errors.percentRange'), between(0, 100)),
  },
  customAnnualRatePct: {
    requiredIfCustom: requiredIf(() => form.depreciationPreset === DEPRECIATION_PRESET.custom),
    between: helpers.withMessage(() => t('forms.createVehicle.errors.percentRange'), between(0, 100)),
  },
  currentMileage: {
    integer,
    minValue: helpers.withMessage(
      () => t('forms.createVehicle.errors.mileageRange', { max: MAX_MILEAGE.toLocaleString('id-ID') }),
      minValue(0),
    ),
    maxValue: helpers.withMessage(
      () => t('forms.createVehicle.errors.mileageRange', { max: MAX_MILEAGE.toLocaleString('id-ID') }),
      maxValue(MAX_MILEAGE),
    ),
  },
};

const { isFormValid, getFieldErrorMessage, touchField } = useFormValidation(
  { form },
  { form: validationRules },
  undefined,
  {
    customValidationMessages: {
      required: t('validation.required'),
      requiredIfCustom: t('validation.required'),
      integer: t('forms.createVehicle.errors.integer'),
    },
  },
);

const isSubmitDisabled = computed(
  () =>
    !form.name.trim() ||
    !form.make.trim() ||
    !form.model.trim() ||
    !Number.isInteger(form.year) ||
    form.year! < MIN_YEAR ||
    form.year! > MAX_YEAR ||
    !Number.isFinite(form.salvageFloorPct) ||
    form.salvageFloorPct < 0 ||
    form.salvageFloorPct > 100 ||
    (form.depreciationPreset === DEPRECIATION_PRESET.custom &&
      (form.customAnnualRatePct === null || form.customAnnualRatePct < 0 || form.customAnnualRatePct > 100)) ||
    (form.currentMileage !== null &&
      (!Number.isInteger(form.currentMileage) || form.currentMileage < 0 || form.currentMileage > MAX_MILEAGE)),
);

const updateMutation = useMutation({ mutationFn: updateVehicle });

const submit = async () => {
  if (updateMutation.isPending.value) return;

  if (!isFormValid()) return;

  try {
    await updateMutation.mutateAsync({
      id: props.vehicle.id,
      payload: {
        name: form.name,
        make: form.make,
        model: form.model,
        trim: form.trim || null,
        year: form.year!,
        vehicleClass: form.vehicleClass,
        depreciationPreset: form.depreciationPreset,
        customAnnualRatePct: form.depreciationPreset === DEPRECIATION_PRESET.custom ? form.customAnnualRatePct : null,
        salvageFloorPct: form.salvageFloorPct,
        currentMileage: form.currentMileage,
      },
    });

    addNotification({
      text: t('forms.editVehicle.notifications.success'),
      type: NotificationType.success,
    });

    // Vehicle cache keys are prefixed with `transactionChange`, so the
    // predicate invalidation also covers vehiclesList + vehicleDetail.
    queryClient.invalidateQueries({
      predicate: (q) => (q.queryKey as string[]).includes(VUE_QUERY_GLOBAL_PREFIXES.transactionChange),
    });

    emit('updated');
  } catch (error) {
    addNotification({
      text: t('forms.editVehicle.notifications.error'),
      type: NotificationType.error,
    });
    captureException({ error, context: { source: 'editVehicleForm', vehicleId: props.vehicle.id } });
  }
};
</script>

<template>
  <form class="grid gap-6" @submit.prevent="submit">
    <input-field
      v-model="form.name"
      :label="$t('forms.createVehicle.nameLabel')"
      :error-message="getFieldErrorMessage('form.name')"
      @blur="touchField('form.name')"
    />

    <div class="grid grid-cols-2 gap-4">
      <input-field
        v-model="form.make"
        :label="$t('forms.createVehicle.makeLabel')"
        :error-message="getFieldErrorMessage('form.make')"
        @blur="touchField('form.make')"
      />
      <input-field
        v-model="form.model"
        :label="$t('forms.createVehicle.modelLabel')"
        :error-message="getFieldErrorMessage('form.model')"
        @blur="touchField('form.model')"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <input-field v-model="form.trim" :label="$t('forms.createVehicle.trimLabel')" />
      <input-field
        v-model="vehicleYearInput"
        type="text"
        inputmode="numeric"
        maxlength="4"
        pattern="[0-9]{4}"
        :label="$t('forms.createVehicle.yearLabel')"
        :error-message="getFieldErrorMessage('form.year')"
        @blur="touchField('form.year')"
      />
    </div>

    <OptionPickerDialog
      :model-value="form.vehicleClass"
      :options="vehicleClassOptions"
      :label="$t('forms.createVehicle.vehicleClassLabel')"
      :placeholder="$t('forms.createVehicle.vehicleClassPlaceholder')"
      :error-message="getFieldErrorMessage('form.vehicleClass')"
      required
      @update:model-value="
        (v) => {
          form.vehicleClass = v as VEHICLE_CLASS;
          touchField('form.vehicleClass');
        }
      "
    >
      <template #label-right><FormFieldHelp topic="vehicleClass" /></template>
    </OptionPickerDialog>
    <p class="text-muted-foreground -mt-3 text-xs leading-relaxed">
      {{ $t('forms.createVehicle.vehicleClassHint') }}
    </p>

    <SelectField
      :model-value="selectedDepreciationPreset"
      :values="depreciationPresetOptions"
      label-key="label"
      value-key="value"
      :label="$t('forms.createVehicle.depreciationPresetLabel')"
      @update:model-value="(v) => v && (form.depreciationPreset = v.value)"
    />

    <input-field
      v-if="showCustomRate"
      v-model="form.customAnnualRatePct"
      type="number"
      :label="$t('forms.createVehicle.customAnnualRatePctLabel')"
      :error-message="getFieldErrorMessage('form.customAnnualRatePct')"
      @blur="touchField('form.customAnnualRatePct')"
    />

    <input-field
      v-model="form.salvageFloorPct"
      type="number"
      :label="$t('forms.createVehicle.salvageFloorPctLabel')"
      :error-message="getFieldErrorMessage('form.salvageFloorPct')"
      @blur="touchField('form.salvageFloorPct')"
    />

    <input-field
      v-model="form.currentMileage"
      type="number"
      :label="$t('forms.createVehicle.currentMileageLabel')"
      :placeholder="$t('forms.createVehicle.currentMileagePlaceholder')"
      :error-message="getFieldErrorMessage('form.currentMileage')"
      @blur="touchField('form.currentMileage')"
    />

    <div class="flex">
      <ui-button type="submit" class="ml-auto min-w-30" :disabled="isSubmitDisabled || updateMutation.isPending.value">
        {{
          updateMutation.isPending.value
            ? $t('forms.editVehicle.submitButtonLoading')
            : $t('forms.editVehicle.submitButton')
        }}
      </ui-button>
    </div>
  </form>
</template>
