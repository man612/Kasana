import { VEHICLE_CLASS_TRANSLATION_KEYS } from '@/common/const/vehicle-classes-verbose';
import type { PickerOption } from '@/components/fields/option-picker-dialog.vue';
import { VEHICLE_CLASS, VEHICLE_TYPES, type VehicleType } from '@bt/shared/types';
import {
  AccessibilityIcon,
  AmbulanceIcon,
  BikeIcon,
  CarTaxiFrontIcon,
  ConstructionIcon,
  FootprintsIcon,
  MountainIcon,
  GaugeIcon,
  MotorbikeIcon,
  OrbitIcon,
  PlaneTakeoffIcon,
  RocketIcon,
  SailboatIcon,
  BusIcon,
  PlaneIcon,
  ShipIcon,
  SparklesIcon,
  CarFrontIcon,
  CarIcon,
  CircleEllipsisIcon,
  CrownIcon,
  TruckIcon,
  ZapIcon,
} from '@lucide/vue';
import type { Component } from 'vue';

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
    icon: MotorbikeIcon,
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

const catalogueGroups = {
  motorcycles: { icon: MotorbikeIcon, tint: 'bg-warning/10 text-warning-text' },
  cars: { icon: CarIcon, tint: 'bg-primary/10 text-primary-text' },
  commercial: { icon: BusIcon, tint: 'bg-success/10 text-success-text' },
  mobility: { icon: BikeIcon, tint: 'bg-muted text-foreground' },
  watercraft: { icon: ShipIcon, tint: 'bg-app-transfer-color/10 text-app-transfer-color' },
  aircraft: { icon: PlaneIcon, tint: 'bg-app-transfer-color/10 text-app-transfer-color' },
  fictional: { icon: SparklesIcon, tint: 'bg-primary/10 text-primary-text' },
  other: { icon: CircleEllipsisIcon, tint: 'bg-muted text-muted-foreground' },
};

const typeIcons: Partial<Record<VehicleType, Component>> = {
  sportBike: GaugeIcon,
  trail: MountainIcon,
  electricBike: ZapIcon,
  ev: ZapIcon,
  hybrid: ZapIcon,
  sedan: CarFrontIcon,
  hatchback: CarFrontIcon,
  pickup: TruckIcon,
  van: TruckIcon,
  sportCar: GaugeIcon,
  taxi: CarTaxiFrontIcon,
  truck: TruckIcon,
  emergency: AmbulanceIcon,
  heavyEquipment: ConstructionIcon,
  ebike: ZapIcon,
  wheelchair: AccessibilityIcon,
  powerchair: AccessibilityIcon,
  boat: SailboatIcon,
  yacht: SailboatIcon,
  jet: PlaneTakeoffIcon,
  ufo: OrbitIcon,
  rocket: RocketIcon,
  trex: FootprintsIcon,
  velociraptor: FootprintsIcon,
  triceratops: FootprintsIcon,
};

export function getVehicleTypeIcon({ type, legacyClass }: { type?: VehicleType | null; legacyClass: VEHICLE_CLASS }) {
  return type ? (typeIcons[type] ?? catalogueGroups[VEHICLE_TYPES[type].group].icon) : PRESENTATION[legacyClass].icon;
}

export function buildVehicleTypeOptions({
  translate,
  legacyClass,
}: {
  translate: (key: string) => string;
  legacyClass?: VEHICLE_CLASS;
}): PickerOption[] {
  const legacyOption = legacyClass
    ? [
        {
          value: 'legacy',
          label: translate(VEHICLE_CLASS_TRANSLATION_KEYS[legacyClass]),
          group: translate('forms.createVehicle.legacyType'),
          icon: PRESENTATION[legacyClass].icon,
        },
      ]
    : [];
  return [
    ...legacyOption,
    ...(Object.keys(VEHICLE_TYPES) as VehicleType[]).map((value) => {
      const { group } = VEHICLE_TYPES[value];
      return {
        value,
        label: translate(
          group === 'other' ? 'forms.createVehicle.typeGroups.other' : `forms.createVehicle.types.${value}`,
        ),
        group: group === 'other' ? undefined : translate(`forms.createVehicle.typeGroups.${group}`),
        icon: getVehicleTypeIcon({ type: value, legacyClass: VEHICLE_CLASS.other }),
        groupIcon: catalogueGroups[group].icon,
        iconClass: catalogueGroups[group].tint,
      };
    }),
  ];
}
