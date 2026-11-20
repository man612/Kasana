import {
  DEPRECIATION_PRESET,
  TRANSACTION_TYPES,
  VEHICLE_TYPES,
  type VehicleType,
  type VehicleValuationProfile,
} from '@bt/shared/types';
import { Money } from '@common/types/money';
import { t } from '@i18n/index';
import { ValidationError } from '@js/errors';
import type Transactions from '@models/transactions.model';
import type Vehicles from '@models/vehicles.model';
import { format, parseISO } from 'date-fns';

import { computeVehicleValue } from './compute-vehicle-value';

export const requiresCustomRate = (preset: DEPRECIATION_PRESET) =>
  preset === DEPRECIATION_PRESET.custom || preset === DEPRECIATION_PRESET.straightLine;

export function validateValuationProfile(type: VehicleType | null, profile: VehicleValuationProfile) {
  if (requiresCustomRate(profile.preset) && profile.customAnnualRatePct == null) {
    throw new ValidationError({ message: t({ key: 'vehicles.annualRateRequired' }) });
  }

  const typeInfo = type ? VEHICLE_TYPES[type] : null;
  if (
    typeInfo &&
    typeInfo.vehicleClass === null &&
    profile.preset !== DEPRECIATION_PRESET.manual &&
    (typeInfo.group === 'fictional' || profile.preset !== DEPRECIATION_PRESET.straightLine)
  ) {
    throw new ValidationError({ message: t({ key: 'vehicles.valuationMethodUnavailable' }) });
  }
}

export function getValuationProfile(vehicle: Vehicles): VehicleValuationProfile {
  return {
    vehicleClass: vehicle.vehicleClass,
    preset: vehicle.depreciationPreset,
    customAnnualRatePct: vehicle.customAnnualRatePct === null ? null : Number(vehicle.customAnnualRatePct),
    salvageFloorPct: Number(vehicle.salvageFloorPct),
  };
}

export type ValuationAnchor = { date: string; value: Money; profile: VehicleValuationProfile; override?: true };

export const computeFromAnchor = (anchor: ValuationAnchor, asOf: Date) =>
  computeVehicleValue({ ...anchor.profile, anchorValue: anchor.value, anchorDate: parseISO(anchor.date), asOf });

/** The stored current anchor is an exact manual value, including for older accounts. */
export function getCurrentAnchor(vehicle: Vehicles): ValuationAnchor {
  const profile = getValuationProfile(vehicle);
  const revision = vehicle.valuationRevisions?.at(-1);
  const revisionDate = revision && format(parseISO(revision.effectiveAt), 'yyyy-MM-dd');
  if (
    vehicle.valueAnchor !== null &&
    vehicle.valueAnchorDate &&
    (!revisionDate || vehicle.valueAnchorDate >= revisionDate)
  ) {
    return { date: vehicle.valueAnchorDate, value: vehicle.valueAnchor, profile, override: true };
  }
  if (revision && revisionDate) return { date: revisionDate, value: Money.fromCents(revision.anchorCents), profile };
  return { date: vehicle.purchaseDate, value: vehicle.purchasePrice, profile };
}

type OverrideTransaction = Pick<Transactions, 'time' | 'amount' | 'transactionType'>;

export function buildValuationAnchors(
  vehicle: Vehicles,
  transactions: OverrideTransaction[],
  asOf?: Date,
): ValuationAnchor[] {
  const revisions = vehicle.valuationRevisions ?? [];
  const activeProfile = getValuationProfile(vehicle);
  const anchors: ValuationAnchor[] = [
    {
      date: vehicle.purchaseDate,
      value: vehicle.purchasePrice,
      profile: revisions[0]?.previousProfile ?? activeProfile,
    },
  ];
  const events = [
    ...transactions.map((transaction) => ({ time: transaction.time.getTime(), transaction })),
    ...revisions.map((revision, index) => ({
      time: Date.parse(revision.effectiveAt),
      revision,
      profile: revisions[index + 1]?.previousProfile ?? activeProfile,
    })),
  ]
    .filter((event) => !asOf || event.time <= asOf.getTime())
    .toSorted((a, b) => a.time - b.time);

  for (const event of events) {
    const date = format(event.time, 'yyyy-MM-dd');
    if ('revision' in event) {
      anchors.push({ date, value: Money.fromCents(event.revision.anchorCents), profile: event.profile });
    } else {
      const anchor = anchors.at(-1)!;
      const before = computeFromAnchor(anchor, parseISO(date));
      const delta =
        event.transaction.transactionType === TRANSACTION_TYPES.income
          ? event.transaction.amount
          : Money.zero().subtract(event.transaction.amount);
      const adjusted = before.add(delta);
      anchors.push({
        date,
        value: adjusted.isNegative() ? Money.zero() : adjusted,
        profile: anchor.profile,
        override: true,
      });
    }
  }
  return anchors;
}
