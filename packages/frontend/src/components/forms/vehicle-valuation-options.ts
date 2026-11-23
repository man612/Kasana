import { DEPRECIATION_PRESET, VEHICLE_TYPES, type VehicleType } from '@bt/shared/types';

export function allowedVehiclePresets(type: VehicleType | null): DEPRECIATION_PRESET[] {
  const info = type ? VEHICLE_TYPES[type] : null;
  if (info?.group === 'fictional') return [DEPRECIATION_PRESET.manual];
  if (info?.vehicleClass === null) return [DEPRECIATION_PRESET.manual, DEPRECIATION_PRESET.straightLine];
  return Object.values(DEPRECIATION_PRESET);
}

export function hasVehicleAnnualRate(preset: DEPRECIATION_PRESET) {
  return preset === DEPRECIATION_PRESET.custom || preset === DEPRECIATION_PRESET.straightLine;
}
