import { TRANSACTION_TRANSFER_NATURE } from '@bt/shared/types';
import { Money } from '@common/types/money';
import { findTransactions } from '@models/transactions-query';
import type Vehicles from '@models/vehicles.model';
import { Op } from 'sequelize';

import { buildValuationAnchors, getCurrentAnchor } from './valuation-timeline';

interface ReconstructAnchorParams {
  vehicle: Vehicles;
  /** Optional cutoff — only include override txs ≤ this date. Defaults to now. */
  asOf?: Date;
}

interface ReconstructedAnchor {
  /** Anchor value at `date`, expressed in the vehicle's account currency. */
  value: Money;
  /** yyyy-MM-dd. Date the anchor was set (purchase or latest override ≤ cutoff). */
  date: string;
  /** True if any override was applied; false if anchor is the original purchase. */
  hasOverrides: boolean;
}

export async function loadVehicleValuationAnchors({ vehicle, asOf }: ReconstructAnchorParams) {
  const cutoff = asOf ?? new Date();

  // Overrides are written by the balance-adjustment flow, which stamps them as adjustments —
  // excluding those (the boundary's default) would erase every anchor after the purchase.
  const overrideTxs = await findTransactions({
    planned: 'exclude',
    access: 'unscoped-internal',
    balanceAdjustments: 'include',
    transfers: { natures: [TRANSACTION_TRANSFER_NATURE.transfer_out_wallet] },
    completeness: 'all',
    where: {
      accountId: vehicle.accountId,
      time: { [Op.lte]: cutoff },
    },
    order: [
      ['time', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });

  return buildValuationAnchors(vehicle, overrideTxs, cutoff);
}

export async function getVehicleValuationAnchor(params: ReconstructAnchorParams) {
  if (!params.vehicle.valuationRevisions?.length) return getCurrentAnchor(params.vehicle);
  return (await loadVehicleValuationAnchors(params)).at(-1)!;
}

export async function reconstructVehicleAnchor(params: ReconstructAnchorParams): Promise<ReconstructedAnchor> {
  const anchors = await loadVehicleValuationAnchors(params);
  const lastOverride = anchors.findLast((anchor) => anchor.override);
  const anchor = lastOverride ?? anchors[0]!;
  return { value: anchor.value, date: anchor.date, hasOverrides: !!lastOverride };
}
