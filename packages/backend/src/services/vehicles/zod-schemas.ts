import {
  DEPRECIATION_PRESET,
  VEHICLE_CLASS,
  VEHICLE_TYPES,
  VEHICLE_PLATE_MAX_LENGTH,
  normalizeVehiclePlate,
  type VehicleType,
} from '@bt/shared/types';
import { currencyCode, recordId } from '@common/lib/zod/custom-types';
import { Money } from '@common/types/money';
import { z } from 'zod';

const vehicleType = z.enum(Object.keys(VEHICLE_TYPES) as [VehicleType, ...VehicleType[]]);
const licensePlate = z
  .string()
  .transform(normalizeVehiclePlate)
  .pipe(
    z
      .string()
      .max(VEHICLE_PLATE_MAX_LENGTH)
      .regex(/^[^\p{Cc}]*$/u),
  )
  .transform((plate) => plate || null)
  .nullable()
  .optional();

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create body of `POST /vehicles`. The purchase price is a plain decimal in the field shape, which
 * the MCP tool exposes as its input; the body schema below turns it into `Money`.
 */
export const createVehicleBodyFields = {
  name: z.string().trim().min(1).max(200),
  currencyCode: currencyCode(),
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  trim: z.string().max(100).nullable().optional(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  vehicleClass: z.nativeEnum(VEHICLE_CLASS),
  vehicleType: vehicleType.nullable().optional(),
  licensePlate,
  purchasePrice: z.number().positive({ message: 'purchasePrice must be > 0' }),
  purchaseDate: z.string().regex(datePattern, 'purchaseDate must be YYYY-MM-DD'),
  depreciationPreset: z.nativeEnum(DEPRECIATION_PRESET).optional(),
  customAnnualRatePct: z.number().min(0).max(100).nullable().optional(),
  salvageFloorPct: z.number().min(0).max(100).optional(),
  currentMileage: z.number().int().min(0).nullable().optional(),
};

export const createVehicleBodySchema = z
  .object(createVehicleBodyFields)
  .transform((body) => ({ ...body, purchasePrice: Money.fromDecimal(body.purchasePrice) }));

/**
 * Patch body of `PATCH /vehicles/:id`. The purchase price, purchase date and currency are
 * absent on purpose: the depreciation curve and the account are anchored to them.
 */
export const updateVehicleBodyFields = {
  name: z.string().trim().min(1).max(200).optional(),
  make: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  trim: z.string().max(100).nullable().optional(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  vehicleClass: z.nativeEnum(VEHICLE_CLASS).optional(),
  vehicleType: vehicleType.nullable().optional(),
  licensePlate,
  depreciationPreset: z.nativeEnum(DEPRECIATION_PRESET).optional(),
  customAnnualRatePct: z.number().min(0).max(100).nullable().optional(),
  salvageFloorPct: z.number().min(0).max(100).optional(),
  currentMileage: z.number().int().min(0).nullable().optional(),
};

export const updateVehicleBodySchema = z.object(updateVehicleBodyFields);

export const vehicleIdParamsSchema = z.object({ id: recordId() });
