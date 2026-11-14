<script setup lang="ts">
import { createVehicle } from '@/api/vehicles';
import { VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const';
import {
  DEPRECIATION_PRESET_TRANSLATION_KEYS,
  VEHICLE_CLASS_TRANSLATION_KEYS,
} from '@/common/const/vehicle-classes-verbose';
import FormFieldHelp from '@/components/common/form-field-help.vue';
import DateField from '@/components/fields/date-field.vue';
import InputField from '@/components/fields/input-field.vue';
import FormattedAmountField from '@/components/fields/formatted-amount-field.vue';
import OptionPickerDialog from '@/components/fields/option-picker-dialog.vue';
import SelectField from '@/components/fields/select-field.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useFormValidation } from '@/composable/form-validator';
import { captureException } from '@/lib/sentry';
import { DEPRECIATION_PRESET, VEHICLE_CLASS } from '@bt/shared/types';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { between, helpers, integer, maxValue, minValue, required, requiredIf } from '@vuelidate/validators';
import { format } from 'date-fns';
import { CarFrontIcon, CarIcon, CircleEllipsisIcon, TruckIcon, ZapIcon, BikeIcon, CrownIcon } from '@lucide/vue';
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

const DEFAULT_SALVAGE_FLOOR_PCT = 10;
const MIN_YEAR = 1900;
const MAX_YEAR = new Date().getFullYear() + 1;
const MAX_MILEAGE = 10_000_000;

const positiveNumber = helpers.withMessage(
  () => t('forms.createVehicle.errors.positive'),
  (v: unknown) => v != null && Number(v) > 0,
);

const emit = defineEmits<{ created: [] }>();

const { t } = useI18n();
const queryClient = useQueryClient();
const { addNotification } = useNotificationCenter();

interface FormState {
  name: string;
  currencyCode: string;
  make: string;
  model: string;
  trim: string;
  year: number | null;
  vehicleClass: VEHICLE_CLASS | null;
  purchasePrice: number;
  purchaseDate: Date;
  depreciationPreset: DEPRECIATION_PRESET;
  customAnnualRatePct: number | null;
  salvageFloorPct: number;
  currentMileage: number | null;
}

const form = reactive<FormState>({
  name: '',
  currencyCode: 'IDR',
  make: '',
  model: '',
  trim: '',
  year: new Date().getFullYear(),
  // Explicit choice: selecting Sedan by default silently applies the wrong depreciation to motorcycles and MPVs.
  vehicleClass: null,
  purchasePrice: 0,
  purchaseDate: new Date(),
  depreciationPreset: DEPRECIATION_PRESET.classDefault,
  customAnnualRatePct: null,
  salvageFloorPct: DEFAULT_SALVAGE_FLOOR_PCT,
  currentMileage: null,
});

const vehicleIconMeta = {
  [VEHICLE_CLASS.sedan]: { icon: CarFrontIcon, iconClass: 'text-blue-500', description: 'Sedan dan hatchback' },
  [VEHICLE_CLASS.suv]: { icon: CarIcon, iconClass: 'text-emerald-500', description: 'SUV dan crossover' },
  [VEHICLE_CLASS.truck]: { icon: TruckIcon, iconClass: 'text-amber-500', description: 'Pikap dan kendaraan angkut' },
  [VEHICLE_CLASS.luxury]: { icon: CrownIcon, iconClass: 'text-violet-500', description: 'Mobil premium' },
  [VEHICLE_CLASS.ev]: { icon: ZapIcon, iconClass: 'text-teal-500', description: 'Kendaraan listrik' },
  [VEHICLE_CLASS.motorcycle]: { icon: BikeIcon, iconClass: 'text-orange-500', description: 'Sepeda motor' },
  [VEHICLE_CLASS.other]: {
    icon: CircleEllipsisIcon,
    iconClass: 'text-slate-500',
    description: 'MPV, LCGC, dan jenis lain; periksa estimasi penyusutannya',
  },
} as const;
const vehicleClassOptions = computed(() =>
  Object.values(VEHICLE_CLASS).map((value) => ({
    label: t(VEHICLE_CLASS_TRANSLATION_KEYS[value]),
    value,
    ...vehicleIconMeta[value],
  })),
);
// Keep the persisted depreciation classes unchanged: creating new types without
// tested rate curves would silently invent vehicle valuations.
const vehicleYearInput = computed({
  get: () => form.year?.toString() ?? '',
  set: (value: string | number | null) => {
    const digits = String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 4);
    form.year = digits ? Number(digits) : null;
  },
});

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
  purchasePrice: { positive: positiveNumber, maxValue: maxValue(Number.MAX_SAFE_INTEGER) },
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
    customValidationMessages: { required: t('validation.required'), integer: t('forms.createVehicle.errors.integer') },
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
    form.vehicleClass === null ||
    !Number.isFinite(form.purchasePrice) ||
    form.purchasePrice <= 0 ||
    !Number.isFinite(form.salvageFloorPct) ||
    form.salvageFloorPct < 0 ||
    form.salvageFloorPct > 100 ||
    (form.depreciationPreset === DEPRECIATION_PRESET.custom &&
      (form.customAnnualRatePct === null || form.customAnnualRatePct < 0 || form.customAnnualRatePct > 100)) ||
    (form.currentMileage !== null &&
      (!Number.isInteger(form.currentMileage) || form.currentMileage < 0 || form.currentMileage > MAX_MILEAGE)),
);

const createVehicleMutation = useMutation({ mutationFn: createVehicle });
const props = withDefaults(defineProps<{ formId?: string; showSubmitButton?: boolean }>(), { showSubmitButton: true });
defineExpose({ isSubmitting: createVehicleMutation.isPending, isSubmitDisabled });

const submit = async () => {
  if (createVehicleMutation.isPending.value) return;

  if (!isFormValid()) return;
  const vehicleClass = form.vehicleClass;
  if (vehicleClass === null) return;

  try {
    await createVehicleMutation.mutateAsync({
      name: form.name,
      currencyCode: form.currencyCode,
      make: form.make,
      model: form.model,
      trim: form.trim || null,
      year: form.year!,
      vehicleClass,
      purchasePrice: form.purchasePrice,
      purchaseDate: format(form.purchaseDate, 'yyyy-MM-dd'),
      depreciationPreset: form.depreciationPreset,
      customAnnualRatePct: form.depreciationPreset === DEPRECIATION_PRESET.custom ? form.customAnnualRatePct : null,
      salvageFloorPct: form.salvageFloorPct,
      currentMileage: form.currentMileage,
    });

    addNotification({
      text: t('forms.createVehicle.notifications.success'),
      type: NotificationType.success,
    });

    // Vehicle cache keys are prefixed with `transactionChange`, so a single
    // predicate invalidation also covers vehiclesList.
    queryClient.invalidateQueries({
      predicate: (query) => {
        const queryKey = query.queryKey as string[];
        return queryKey.includes(VUE_QUERY_GLOBAL_PREFIXES.transactionChange);
      },
    });

    emit('created');
  } catch (error) {
    addNotification({
      text: t('forms.createVehicle.notifications.error'),
      type: NotificationType.error,
    });
    captureException({ error, context: { source: 'createVehicleForm' } });
  }
};
</script>

<template>
  <form :id="props.formId" class="@container/create-vehicle grid gap-4" @submit.prevent="submit">
    <input type="hidden" name="currencyCode" :value="form.currencyCode" />
    <input-field
      v-model="form.name"
      :label="$t('forms.createVehicle.nameLabel')"
      :placeholder="$t('forms.createVehicle.namePlaceholder')"
      :error-message="getFieldErrorMessage('form.name')"
      @blur="touchField('form.name')"
      non-label-wrapper
      :aria-label="$t('forms.createVehicle.nameLabel')"
    >
      <template #label-right>
        <FormFieldHelp topic="vehicleName" />
      </template>
    </input-field>

    <div class="grid grid-cols-2 gap-4">
      <input-field
        v-model="form.make"
        :label="$t('forms.createVehicle.makeLabel')"
        placeholder="Toyota"
        :error-message="getFieldErrorMessage('form.make')"
        @blur="touchField('form.make')"
        non-label-wrapper
        :aria-label="$t('forms.createVehicle.makeLabel')"
      >
        <template #label-right>
          <FormFieldHelp topic="vehicleMake" />
        </template>
      </input-field>
      <input-field
        v-model="form.model"
        :label="$t('forms.createVehicle.modelLabel')"
        placeholder="Avanza / Vario"
        :error-message="getFieldErrorMessage('form.model')"
        @blur="touchField('form.model')"
        non-label-wrapper
        :aria-label="$t('forms.createVehicle.modelLabel')"
      >
        <template #label-right>
          <FormFieldHelp topic="vehicleModel" />
        </template>
      </input-field>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <input-field
        v-model="form.trim"
        :label="$t('forms.createVehicle.trimLabel')"
        placeholder="G CVT / 160 CBS"
        non-label-wrapper
        :aria-label="$t('forms.createVehicle.trimLabel')"
      >
        <template #label-right>
          <FormFieldHelp topic="vehicleTrim" />
        </template>
      </input-field>
      <input-field
        v-model="vehicleYearInput"
        type="text"
        inputmode="numeric"
        maxlength="4"
        pattern="[0-9]{4}"
        :label="$t('forms.createVehicle.yearLabel')"
        :error-message="getFieldErrorMessage('form.year')"
        @blur="touchField('form.year')"
        non-label-wrapper
        :aria-label="$t('forms.createVehicle.yearLabel')"
      >
        <template #label-right>
          <FormFieldHelp topic="vehicleYear" />
        </template>
      </input-field>
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

    <FormattedAmountField
      v-model="form.purchasePrice"
      currency-code="IDR"
      :label="$t('forms.createVehicle.purchasePriceLabel')"
      :error-message="getFieldErrorMessage('form.purchasePrice')"
      @blur="touchField('form.purchasePrice')"
      :aria-label="$t('forms.createVehicle.purchasePriceLabel')"
    >
      <template #label-right>
        <FormFieldHelp topic="vehiclePurchasePrice" />
      </template>
    </FormattedAmountField>

    <DateField v-model="form.purchaseDate" :label="$t('forms.createVehicle.purchaseDateLabel')">
      <template #label-right><FormFieldHelp topic="vehiclePurchaseDate" /></template>
    </DateField>

    <SelectField
      :model-value="selectedDepreciationPreset"
      :values="depreciationPresetOptions"
      label-key="label"
      value-key="value"
      :label="$t('forms.createVehicle.depreciationPresetLabel')"
      @update:model-value="(v) => v && (form.depreciationPreset = v.value)"
    >
      <template #label-right><FormFieldHelp topic="vehicleDepreciation" /></template>
    </SelectField>

    <input-field
      v-if="showCustomRate"
      v-model="form.customAnnualRatePct"
      type="number"
      :label="$t('forms.createVehicle.customAnnualRatePctLabel')"
      :error-message="getFieldErrorMessage('form.customAnnualRatePct')"
      @blur="touchField('form.customAnnualRatePct')"
      non-label-wrapper
      :aria-label="$t('forms.createVehicle.customAnnualRatePctLabel')"
    >
      <template #label-right>
        <FormFieldHelp topic="vehicleCustomRate" />
      </template>
    </input-field>

    <input-field
      v-model="form.salvageFloorPct"
      type="number"
      :label="$t('forms.createVehicle.salvageFloorPctLabel')"
      :error-message="getFieldErrorMessage('form.salvageFloorPct')"
      @blur="touchField('form.salvageFloorPct')"
      non-label-wrapper
      :aria-label="$t('forms.createVehicle.salvageFloorPctLabel')"
    >
      <template #label-right>
        <FormFieldHelp topic="vehicleFloor" />
      </template>
    </input-field>

    <FormattedAmountField
      v-model="form.currentMileage"
      :label="$t('forms.createVehicle.currentMileageLabel')"
      :placeholder="$t('forms.createVehicle.currentMileagePlaceholder')"
      :error-message="getFieldErrorMessage('form.currentMileage')"
      @blur="touchField('form.currentMileage')"
      :aria-label="$t('forms.createVehicle.currentMileageLabel')"
    >
      <template #label-right><FormFieldHelp topic="vehicleMileage" /></template>
      <template #iconTrailing><span class="text-muted-foreground text-xs">km</span></template>
    </FormattedAmountField>

    <div v-if="props.showSubmitButton" class="flex">
      <ui-button
        type="submit"
        class="ml-auto min-w-30"
        :disabled="createVehicleMutation.isPending.value || isSubmitDisabled"
      >
        {{
          createVehicleMutation.isPending.value
            ? $t('forms.createVehicle.submitButtonLoading')
            : $t('forms.createVehicle.submitButton')
        }}
      </ui-button>
    </div>
  </form>
</template>
