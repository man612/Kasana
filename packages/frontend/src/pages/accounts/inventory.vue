<script setup lang="ts">
import { getVehicles } from '@/api/vehicles';
import { VUE_QUERY_CACHE_KEYS } from '@/common/const';
import PageWrapper from '@/components/common/page-wrapper.vue';
import CreateVehicleDialog from '@/components/dialogs/create-vehicle-dialog.vue';
import { Button } from '@/components/lib/ui/button';
import NavigationSectionTitle from '@/components/sidebar/navigation-section-title.vue';
import { useQuery } from '@tanstack/vue-query';
import { CarIcon, PlusIcon } from '@lucide/vue';
import { computed } from 'vue';

import VehicleInventoryRows from './components/vehicle-inventory-rows.vue';
import { useAccountsSort } from './use-accounts-sort';

const { data, isPending, isError, refetch } = useQuery({
  queryKey: VUE_QUERY_CACHE_KEYS.vehiclesList,
  queryFn: getVehicles,
});
const { sortVehicles } = useAccountsSort();
const vehicles = computed(() => sortVehicles((data.value ?? []).filter((vehicle) => vehicle.account !== null)));
</script>

<template>
  <PageWrapper class="grid max-w-4xl gap-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <NavigationSectionTitle
          section="accounts"
          :label="$t('navigation.inventory')"
          class="text-2xl font-semibold tracking-tight"
        />
        <p class="text-muted-foreground text-sm">{{ $t('accounts.inventory.description') }}</p>
      </div>
      <CreateVehicleDialog v-if="vehicles.length">
        <Button size="sm"><PlusIcon class="size-4" />{{ $t('accounts.createVehicle') }}</Button>
      </CreateVehicleDialog>
    </header>
    <VehicleInventoryRows v-if="vehicles.length" :vehicles="vehicles" />
    <div v-else-if="isPending" class="bg-muted h-16 rounded-xl motion-safe:animate-pulse" aria-busy="true" />
    <div
      v-else-if="isError"
      class="border-border grid justify-items-center gap-2 rounded-xl border p-6 text-center"
      role="status"
    >
      <p>{{ $t('common.errors.pageLoadFailed') }}</p>
      <Button size="sm" variant="outline" @click="refetch()">{{ $t('common.actions.retry') }}</Button>
    </div>
    <div v-else class="border-border bg-card grid justify-items-center gap-2 rounded-xl border p-6 text-center">
      <span class="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full"
        ><CarIcon class="size-5"
      /></span>
      <p class="font-semibold">{{ $t('accounts.inventory.empty') }}</p>
      <p class="text-muted-foreground text-sm">{{ $t('accounts.inventory.hint') }}</p>
      <CreateVehicleDialog>
        <Button size="sm"><PlusIcon class="size-4" />{{ $t('accounts.createVehicle') }}</Button>
      </CreateVehicleDialog>
    </div>
  </PageWrapper>
</template>
