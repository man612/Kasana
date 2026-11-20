import { VEHICLE_CLASS } from '@bt/shared/types';
import { MotorbikeIcon } from '@lucide/vue';
import { describe, expect, it } from 'vitest';

import { buildVehicleClassOptions, buildVehicleTypeOptions, getVehicleTypeIcon } from './vehicle-class-options';

describe('buildVehicleClassOptions', () => {
  it('keeps the existing persisted depreciation classes and groups them for display only', () => {
    const options = buildVehicleClassOptions((key) => key);

    expect(options.map((option) => option.value)).toEqual([
      VEHICLE_CLASS.sedan,
      VEHICLE_CLASS.suv,
      VEHICLE_CLASS.luxury,
      VEHICLE_CLASS.ev,
      VEHICLE_CLASS.truck,
      VEHICLE_CLASS.motorcycle,
      VEHICLE_CLASS.other,
    ]);
    expect(
      options.filter((option) => option.group === 'forms.createVehicle.vehicleClassGroups.carCurves'),
    ).toHaveLength(4);
    expect(options.find((option) => option.value === VEHICLE_CLASS.other)?.description).toBe(
      'forms.createVehicle.vehicleClassDescriptions.other',
    );
  });
});

describe('vehicle type presentation', () => {
  it('keeps the stored Other identifier as a directly selectable option', () => {
    const option = buildVehicleTypeOptions({ translate: (key) => key }).find(({ value }) => value === 'other');
    expect(option).toMatchObject({ value: 'other', label: 'forms.createVehicle.typeGroups.other' });
    expect(option?.group).toBeUndefined();
  });

  it('uses a motorcycle icon for both catalogued and legacy motorcycles', () => {
    expect(getVehicleTypeIcon({ type: 'motorcycle', legacyClass: VEHICLE_CLASS.other })).toBe(MotorbikeIcon);
    expect(getVehicleTypeIcon({ legacyClass: VEHICLE_CLASS.motorcycle })).toBe(MotorbikeIcon);
  });
});
