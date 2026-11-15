import { VEHICLE_CLASS } from '@bt/shared/types';
import { describe, expect, it } from 'vitest';
import { buildVehicleClassOptions } from './vehicle-class-options';

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
    expect(options.filter((option) => option.group === 'forms.createVehicle.vehicleClassGroups.carCurves')).toHaveLength(4);
    expect(options.find((option) => option.value === VEHICLE_CLASS.other)?.description).toBe(
      'forms.createVehicle.vehicleClassDescriptions.other',
    );
  });
});
