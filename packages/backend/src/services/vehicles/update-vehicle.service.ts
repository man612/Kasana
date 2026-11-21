import { DEPRECIATION_PRESET, VEHICLE_CLASS, VEHICLE_TYPES, type VehicleType } from '@bt/shared/types';
import Accounts from '@models/accounts.model';
import Vehicles from '@models/vehicles.model';
import { withTransaction } from '@services/common/with-transaction';

import { findVehicleOrThrow } from './helpers';
import { getVehicleValuationAnchor } from './reconstruct-vehicle-anchor';
import { refreshVehicleValueIfStale } from './refresh-vehicle-value.service';
import { computeFromAnchor, getValuationProfile, validateValuationProfile } from './valuation-timeline';

interface UpdateVehicleParams {
  userId: number;
  vehicleId: string;
  name?: string;
  make?: string;
  model?: string;
  trim?: string | null;
  year?: number;
  vehicleClass?: VEHICLE_CLASS;
  vehicleType?: VehicleType | null;
  licensePlate?: string | null;
  depreciationPreset?: DEPRECIATION_PRESET;
  customAnnualRatePct?: number | null;
  salvageFloorPct?: number;
  currentMileage?: number | null;
}

const updateVehicleImpl = async (params: UpdateVehicleParams) => {
  const { userId, vehicleId, name, ...rest } = params;

  // Adjustment writes also acquire the account lock before persisting vehicle data.
  const { accountId } = await findVehicleOrThrow({ vehicleId, userId, attributes: ['accountId'] });
  await Accounts.findByPk(accountId, { lock: true });
  const vehicle = await findVehicleOrThrow({ vehicleId, userId, lock: true });

  const previous = getValuationProfile(vehicle);
  const vehicleType = rest.vehicleType === undefined ? vehicle.vehicleType : rest.vehicleType;
  const defaultClass = vehicleType ? VEHICLE_TYPES[vehicleType].vehicleClass : null;
  const profile = {
    vehicleClass: vehicleType ? (defaultClass ?? VEHICLE_CLASS.other) : (rest.vehicleClass ?? previous.vehicleClass),
    preset:
      rest.depreciationPreset ??
      (rest.vehicleType && rest.vehicleType !== vehicle.vehicleType && defaultClass === null
        ? DEPRECIATION_PRESET.manual
        : previous.preset),
    customAnnualRatePct:
      rest.customAnnualRatePct === undefined ? previous.customAnnualRatePct : rest.customAnnualRatePct,
    salvageFloorPct: rest.salvageFloorPct ?? previous.salvageFloorPct,
  };
  validateValuationProfile(vehicleType, profile);

  const curveAffectingChange =
    previous.vehicleClass !== profile.vehicleClass ||
    previous.preset !== profile.preset ||
    previous.customAnnualRatePct !== profile.customAnnualRatePct ||
    previous.salvageFloorPct !== profile.salvageFloorPct;

  const now = new Date();
  const valuationRevisions = [...(vehicle.valuationRevisions ?? [])];
  if (curveAffectingChange) {
    const anchor = await getVehicleValuationAnchor({ vehicle, asOf: now });
    valuationRevisions.push({
      effectiveAt: now.toISOString(),
      anchorCents: computeFromAnchor(anchor, now).toCents(),
      previousProfile: previous,
    });
  }

  await vehicle.update({
    ...rest,
    vehicleClass: profile.vehicleClass,
    depreciationPreset: profile.preset,
    ...(curveAffectingChange && { valuationRevisions }),
  });

  if (name !== undefined) {
    await Accounts.update({ name }, { where: { id: vehicle.accountId, userId } });
  }

  if (curveAffectingChange) {
    await refreshVehicleValueIfStale({ vehicleId, force: true, asOf: now });
  }

  return Vehicles.findByPk(vehicleId, {
    include: [{ model: Accounts }],
  });
};

export const updateVehicle = withTransaction(updateVehicleImpl);
