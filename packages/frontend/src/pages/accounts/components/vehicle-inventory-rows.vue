<script setup lang="ts">
import { getVehicleTypeIcon } from '@/components/forms/vehicle-class-options';
import { ACCOUNT_CATEGORIES } from '@bt/shared/types';
import type { VehicleModel } from '@/api/vehicles';

import AccountListRow from './account-list-row.vue';

defineProps<{ vehicles: VehicleModel[] }>();
</script>

<template>
  <div class="border-border/60 bg-card divide-border/60 divide-y overflow-hidden rounded-xl border">
    <template v-for="vehicle in vehicles" :key="vehicle.id">
      <AccountListRow
        v-if="vehicle.account"
        :account="vehicle.account"
        :vehicle-id="vehicle.id"
        :subtitle="`${vehicle.year} ${vehicle.make} ${vehicle.model}`"
        :category-override="ACCOUNT_CATEGORIES.vehicle"
        :fallback-icon="getVehicleTypeIcon({ type: vehicle.vehicleType, legacyClass: vehicle.vehicleClass })"
      />
    </template>
  </div>
</template>
