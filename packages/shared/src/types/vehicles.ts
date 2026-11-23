/**
 * Legacy vehicle class used to pick the default depreciation curve.
 * Values mix body style, vehicle segment, powertrain and vehicle kind; this is
 * not a normalized Indonesian vehicle taxonomy. VARCHAR in DB, TS-side enum
 * for type safety (per project's no-DB-enums rule).
 */
export enum VEHICLE_CLASS {
  sedan = 'sedan',
  suv = 'suv',
  truck = 'truck',
  luxury = 'luxury',
  ev = 'ev',
  motorcycle = 'motorcycle',
  other = 'other',
}

/**
 * How a vehicle's depreciation is parameterized:
 * - classDefault: use the per-class default curve as-is.
 * - slow / average / fast: scale the per-class default curve by a preset multiplier.
 * - custom: ignore class curve, apply a single flat annual rate (customAnnualRatePct).
 */
export enum DEPRECIATION_PRESET {
  classDefault = 'class-default',
  slow = 'slow',
  average = 'average',
  fast = 'fast',
  custom = 'custom',
  straightLine = 'straight-line',
  manual = 'manual',
}

/**
 * Default annual depreciation rates (percent) by year-since-purchase, indexed
 * per legacy vehicle class. Year 0 = the first year of ownership. These are
 * generic directional heuristics informed by overseas (including iSeeCars /
 * Edmunds) studies, not an Indonesia-calibrated resale-price model. Do not
 * present them as a market quote. Recalibrate only when comparable local data
 * with documented sources, dates, sample sizes and methodology is available.
 *
 * After the array end, callers fall back to TAIL_RATE_PCT.
 *
 * Lives in the shared package so backend (`compute-vehicle-value.ts`) and
 * frontend (depreciation chart) share one source of truth — divergence would
 * silently make the chart disagree with the headline value.
 */
export const CLASS_DEFAULT_CURVES: Record<VEHICLE_CLASS, number[]> = {
  [VEHICLE_CLASS.sedan]: [20, 15, 12, 10, 8, 7, 6, 5, 5, 4],
  [VEHICLE_CLASS.suv]: [18, 14, 11, 10, 8, 7, 6, 5, 5, 4],
  [VEHICLE_CLASS.truck]: [15, 12, 10, 9, 8, 7, 6, 5, 5, 4],
  [VEHICLE_CLASS.luxury]: [25, 18, 14, 12, 10, 8, 7, 6, 5, 5],
  [VEHICLE_CLASS.ev]: [22, 17, 13, 10, 8, 7, 6, 5, 5, 4],
  [VEHICLE_CLASS.motorcycle]: [20, 15, 12, 10, 8, 7, 6, 5, 5, 4],
  [VEHICLE_CLASS.other]: [20, 15, 12, 10, 8, 7, 6, 5, 5, 4],
};

/** Annual rate applied beyond the explicit curve. */
export const TAIL_RATE_PCT = 4;

/**
 * Multipliers applied to the per-class default curve for the slow / average /
 * fast presets. `average` is identity (1.0).
 */
export const PRESET_MULTIPLIERS = {
  slow: 0.7,
  average: 1.0,
  fast: 1.3,
} as const;

/** Empty catalogue metadata on existing rows keeps their original class and valuation profile. */
export const VEHICLE_TYPES = {
  motorcycle: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  scooter: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  automatic: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  sportBike: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  underbone: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  trail: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  cruiser: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  touring: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.motorcycle },
  electricBike: { group: 'motorcycles', vehicleClass: VEHICLE_CLASS.ev },
  sedan: { group: 'cars', vehicleClass: VEHICLE_CLASS.sedan },
  hatchback: { group: 'cars', vehicleClass: VEHICLE_CLASS.sedan },
  suv: { group: 'cars', vehicleClass: VEHICLE_CLASS.suv },
  mpv: { group: 'cars', vehicleClass: VEHICLE_CLASS.suv },
  pickup: { group: 'cars', vehicleClass: VEHICLE_CLASS.truck },
  van: { group: 'cars', vehicleClass: VEHICLE_CLASS.truck },
  ev: { group: 'cars', vehicleClass: VEHICLE_CLASS.ev },
  hybrid: { group: 'cars', vehicleClass: VEHICLE_CLASS.sedan },
  sportCar: { group: 'cars', vehicleClass: VEHICLE_CLASS.luxury },
  classicCar: { group: 'cars', vehicleClass: null },
  bus: { group: 'commercial', vehicleClass: null },
  minibus: { group: 'commercial', vehicleClass: null },
  taxi: { group: 'commercial', vehicleClass: null },
  angkot: { group: 'commercial', vehicleClass: null },
  truck: { group: 'commercial', vehicleClass: VEHICLE_CLASS.truck },
  emergency: { group: 'commercial', vehicleClass: null },
  heavyEquipment: { group: 'commercial', vehicleClass: null },
  bicycle: { group: 'mobility', vehicleClass: null },
  ebike: { group: 'mobility', vehicleClass: null },
  wheelchair: { group: 'mobility', vehicleClass: null },
  powerchair: { group: 'mobility', vehicleClass: null },
  mobilityScooter: { group: 'mobility', vehicleClass: null },
  kickScooter: { group: 'mobility', vehicleClass: null },
  ship: { group: 'watercraft', vehicleClass: null },
  boat: { group: 'watercraft', vehicleClass: null },
  yacht: { group: 'watercraft', vehicleClass: null },
  helicopter: { group: 'aircraft', vehicleClass: null },
  plane: { group: 'aircraft', vehicleClass: null },
  jet: { group: 'aircraft', vehicleClass: null },
  ufo: { group: 'fictional', vehicleClass: null },
  rocket: { group: 'fictional', vehicleClass: null },
  trex: { group: 'fictional', vehicleClass: null },
  velociraptor: { group: 'fictional', vehicleClass: null },
  triceratops: { group: 'fictional', vehicleClass: null },
  other: { group: 'other', vehicleClass: null },
} as const;

export type VehicleType = keyof typeof VEHICLE_TYPES;

export const VEHICLE_PLATE_MAX_LENGTH = 32;
export const normalizeVehiclePlate = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

export type VehicleValuationProfile = {
  vehicleClass: VEHICLE_CLASS;
  preset: DEPRECIATION_PRESET;
  customAnnualRatePct: number | null;
  salvageFloorPct: number;
};

/** An effective-dated change starts a new curve from the value recorded at that time. */
export interface VehicleValuationRevision {
  effectiveAt: string;
  anchorCents: number;
  previousProfile: VehicleValuationProfile;
}

export type VehicleValuationSegment = VehicleValuationProfile & { date: string; value: number };
