import { VEHICLE_CLASS } from '@bt/shared/types';
import {
  BikeIcon,
  CarFrontIcon,
  CarIcon,
  CircleEllipsisIcon,
  CrownIcon,
  TruckIcon,
  ZapIcon,
} from '@lucide/vue';
import type { Component } from 'vue';
import { VEHICLE_CLASS_TRANSLATION_KEYS } from '@/common/const/vehicle-classes-verbose';
import type { PickerOption } from '@/components/fields/option-picker-dialog.vue';

type VehicleClassPresentation = {
  groupKey: string;
  descriptionKey: string;
  icon: Component;
  iconClass: string;
};

// These are display groups for the available depreciation curves, not new
// legal vehicle categories or persisted vehicle types.
const PRESENTATION: Record<VEHICLE_CLASS, VehicleClassPresentation> = {
  [VEHICLE_CLASS.sedan]: {
    groupKey: 'forms.createVehicle.vehicleClassGroups.carCurves',
    descriptionKey: 'forms.createVehicle.vehicleClassDescriptions.sedan',
    icon: CarFrontIcon,
    iconClass: 'text-blue-500',
  },
  [VEHICLE_CLASS.suv]: {
    groupKey: 'forms.createVehicle.vehicleClassGroups.carCurves',
    descriptionKey: 'forms.createVehicle.vehicleClassDescriptions.suv',
    icon: CarIcon,
    iconClass: 'text-emerald-500',
  },
  [VEHICLE_CLASS.luxury]: {
    groupKey: 'forms.createVehicle.vehicleClassGroups.carCurves',
    descriptionKey: 'forms.createVehicle.vehicleClassDescriptions.luxury',
    icon: CrownIcon,
    iconClass: 'text-violet-500',
  },
  [VEHICLE_CLASS.ev]: {
    groupKey: 'forms.createVehicle.vehicleClassGroups.carCurves',
    descriptionKey: 'forms.createVehicle.vehicleClassDescriptions.ev',
    icon: ZapIcon,
    iconClass: 'text-teal-500',
  },
  [VEHICLE_CLASS.truck]: {
    groupKey: 'forms.createVehicle.vehicleClassGroups.goods',
    descriptionKey: 'forms.createVehicle.vehicleClassDescriptions.truck',
    icon: TruckIcon,
    iconClass: 'text-amber-500',
  },
  [VEHICLE_CLASS.motorcycle]: {
    groupKey: 'forms.createVehicle.vehicleClassGroups.motorcycle',
    descriptionKey: 'forms.createVehicle.vehicleClassDescriptions.motorcycle',
    icon: BikeIcon,
    iconClass: 'text-orange-500',
  },
  [VEHICLE_CLASS.other]: {
    groupKey: 'forms.createVehicle.vehicleClassGroups.fallback',
    descriptionKey: 'forms.createVehicle.vehicleClassDescriptions.other',
    icon: CircleEllipsisIcon,
    iconClass: 'text-slate-500',
  },
};

const OPTION_ORDER: VEHICLE_CLASS[] = [
  VEHICLE_CLASS.sedan,
  VEHICLE_CLASS.suv,
  VEHICLE_CLASS.luxury,
  VEHICLE_CLASS.ev,
  VEHICLE_CLASS.truck,
  VEHICLE_CLASS.motorcycle,
  VEHICLE_CLASS.other,
];

/** Build the same localized, grouped class picker for both create and edit forms. */
export function buildVehicleClassOptions(translate: (key: string) => string): PickerOption[] {
  return OPTION_ORDER.map((value) => {
    const presentation = PRESENTATION[value];
    return {
      value,
      label: translate(VEHICLE_CLASS_TRANSLATION_KEYS[value]),
      description: translate(presentation.descriptionKey),
      group: translate(presentation.groupKey),
      icon: presentation.icon,
      iconClass: presentation.iconClass,
    };
  });
}
