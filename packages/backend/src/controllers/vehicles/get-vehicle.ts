import { createController } from '@controllers/helpers/controller-factory';
import { serializeVehicle } from '@root/serializers/vehicles.serializer';
import { getVehicle } from '@services/vehicles/get-vehicle.service';
import { loadVehicleValuationAnchors } from '@services/vehicles/reconstruct-vehicle-anchor';
import { vehicleIdParamsSchema } from '@services/vehicles/zod-schemas';
import { z } from 'zod';

const schema = z.object({
  params: vehicleIdParamsSchema,
});

export default createController(schema, async ({ user, params }) => {
  const vehicle = await getVehicle({ userId: user.id, vehicleId: params.id });
  if (!vehicle) return { data: null };
  const anchors = vehicle.valuationRevisions?.length ? await loadVehicleValuationAnchors({ vehicle }) : undefined;
  return {
    data: {
      ...serializeVehicle(vehicle, { userId: user.id }),
      valuationSegments: anchors?.map(({ date, value, profile }) => ({ date, value: value.toNumber(), ...profile })),
    },
  };
});
