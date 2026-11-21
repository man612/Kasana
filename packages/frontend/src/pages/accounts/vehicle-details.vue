<template>
  <PageWrapper>
    <div v-if="isLoading" class="@container/vehicle grid min-w-0 grid-cols-1 gap-6">
      <div class="bg-card h-28 animate-pulse rounded-2xl"></div>
      <div class="grid gap-4 @lg/vehicle:grid-cols-3">
        <div class="bg-card h-24 animate-pulse rounded-2xl"></div>
        <div class="bg-card h-24 animate-pulse rounded-2xl"></div>
        <div class="bg-card h-24 animate-pulse rounded-2xl"></div>
      </div>
      <div class="bg-card h-96 animate-pulse rounded-2xl"></div>
    </div>

    <div
      v-else-if="!vehicle || !vehicle.account"
      class="flex flex-col items-center justify-center gap-3 py-20 text-center"
    >
      <CarIcon class="text-muted-foreground/40 size-12" />
      <h3 class="text-foreground text-lg font-medium">{{ $t('pages.vehicleDetails.notFound') }}</h3>
      <RouterLink :to="{ name: ROUTES_NAMES.accounts }">
        <UiButton variant="outline" size="sm">{{ $t('pages.vehicleDetails.backToAccounts') }}</UiButton>
      </RouterLink>
    </div>

    <div v-else class="@container/vehicle grid min-w-0 grid-cols-1 gap-3 wrap-anywhere @2xl/vehicle:gap-5">
      <section class="bg-card grid min-w-0 gap-1.5 rounded-2xl border p-3 @2xl/vehicle:gap-3 @2xl/vehicle:p-6">
        <div class="flex min-w-0 items-start gap-3">
          <AccountLogoPicker
            v-if="isOwner"
            :account-id="vehicle.accountId"
            :fallback-icon="vehicleIcon"
            class="size-9 shrink-0"
          />
          <AccountLogo
            v-else-if="linkedAccount"
            :account="linkedAccount"
            :fallback-icon="vehicleIcon"
            class="size-9 shrink-0"
          />
          <div class="min-w-0 flex-1">
            <p class="text-muted-foreground text-xs">{{ vehicleTypeLabel }}</p>
            <h1 class="text-xl leading-tight font-semibold tracking-tight @2xl/vehicle:text-3xl">
              {{ vehicle.account.name || `${vehicle.make} ${vehicle.model}` }}
            </h1>
            <p class="text-muted-foreground text-xs">
              {{ vehicle.year }} {{ vehicle.make }} {{ vehicle.model
              }}<span v-if="vehicle.trim"> · {{ vehicle.trim }}</span>
            </p>
          </div>
        </div>

        <div class="grid min-w-0 gap-0.5">
          <div class="text-muted-foreground flex flex-wrap items-center gap-1 text-xs font-medium">
            <span>{{ $t('pages.vehicleDetails.currentValue') }}</span>
            <HintIcon :title="$t('pages.vehicleDetails.currentValue')" :content="valuationExplanation" />
          </div>
          <VehicleAmount
            :formatted="formatAmountByCurrencyCode(vehicle.account.currentBalance, currencyCode)"
            class="max-w-full min-w-0 text-3xl font-semibold tracking-tight tabular-nums @2xl/vehicle:text-5xl"
          />
          <span v-if="showRefValue" class="text-muted-foreground text-sm tabular-nums">
            ≈ <VehicleAmount :formatted="formatAmountByCurrencyCode(refCurrentBalance, baseCurrencyCode)" />
          </span>
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              class="inline-flex min-w-0 flex-wrap items-center gap-1 text-sm font-medium tabular-nums"
              :class="
                depreciationAmount === 0
                  ? 'text-muted-foreground'
                  : depreciationDirection === 'down'
                    ? 'text-app-expense-color'
                    : 'text-app-income-color'
              "
            >
              <component
                v-if="depreciationAmount !== 0"
                :is="depreciationDirection === 'down' ? ArrowDownRightIcon : ArrowUpRightIcon"
                class="size-4"
                aria-hidden="true"
              />
              <VehicleAmount :formatted="formatAmountByCurrencyCode(Math.abs(depreciationAmount), currencyCode)" />
              <span class="text-muted-foreground font-normal whitespace-nowrap"
                >({{ depreciationPercent === 0 ? '' : depreciationDirection === 'down' ? '-' : '+'
                }}{{ Math.abs(depreciationPercent).toFixed(1) }}%)</span
              >
            </span>
            <span class="text-muted-foreground text-xs">{{
              $t('pages.vehicleDetails.sinceAcquired', { date: formatDisplayDate(vehicle.purchaseDate) })
            }}</span>
          </div>
        </div>

        <div v-if="isOwner" class="flex min-w-0 flex-wrap items-center gap-1.5">
          <UiButton
            class="min-h-11 max-w-full min-w-0 rounded-lg px-2.5 text-xs wrap-anywhere whitespace-normal"
            @click="isOverrideOpen = true"
            >{{ $t('pages.vehicleDetails.overrideValueButton') }}</UiButton
          >
          <UiButton
            variant="outline"
            class="min-h-11 max-w-full min-w-0 rounded-lg px-2.5 text-xs wrap-anywhere whitespace-normal"
            @click="isEditOpen = true"
            >{{ $t('pages.vehicleDetails.editButton') }}</UiButton
          >
          <UiButton
            variant="ghost-destructive"
            size="icon"
            class="size-11 shrink-0"
            :aria-label="$t('pages.vehicleDetails.deleteTitle')"
            :title="$t('pages.vehicleDetails.deleteTitle')"
            @click="isDeleteOpen = true"
          >
            <Trash2Icon class="size-4" aria-hidden="true" />
          </UiButton>
        </div>
      </section>

      <Tabs v-model="activeVehicleTab">
        <TabsList class="max-w-full">
          <TabsTrigger value="summary">{{ $t('pages.vehicleDetails.tabs.summary') }}</TabsTrigger>
          <TabsTrigger value="activity">{{ $t('pages.vehicleDetails.tabs.activity') }}</TabsTrigger>
          <TabsTrigger value="information">{{ $t('pages.vehicleDetails.tabs.information') }}</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" class="space-y-3">
          <!-- KPI strip -->
          <section
            class="bg-card divide-border/65 grid min-w-0 divide-y rounded-2xl border @lg/vehicle:auto-cols-fr @lg/vehicle:grid-flow-col @lg/vehicle:divide-x @lg/vehicle:divide-y-0"
          >
            <div class="min-w-0 px-3 py-2.5 @lg/vehicle:p-4">
              <div class="text-muted-foreground text-xs tracking-wider uppercase">
                {{ $t('pages.vehicleDetails.purchasePrice') }}
              </div>
              <VehicleAmount
                data-testid="vehicle-kpi-money"
                :formatted="formatAmountByCurrencyCode(vehicle.purchasePrice, currencyCode)"
                class="mt-1 block text-lg font-semibold tabular-nums"
              />
              <div v-if="showRefValue" class="text-muted-foreground mt-0.5 text-xs tabular-nums">
                ≈ <VehicleAmount :formatted="formatAmountByCurrencyCode(refPurchasePrice, baseCurrencyCode)" />
              </div>
              <div class="text-muted-foreground mt-1 text-xs">{{ formatDisplayDate(vehicle.purchaseDate) }}</div>
            </div>

            <div class="min-w-0 px-3 py-2.5 @lg/vehicle:p-4">
              <div class="text-muted-foreground text-xs tracking-wider uppercase">
                {{ $t('pages.vehicleDetails.totalDepreciation') }}
              </div>
              <div class="mt-1 flex flex-wrap items-baseline gap-2 text-lg font-semibold tabular-nums">
                <VehicleAmount
                  data-testid="vehicle-kpi-money"
                  :formatted="formatAmountByCurrencyCode(Math.abs(depreciationAmount), currencyCode)"
                  :class="depreciationDirection === 'down' ? 'text-app-expense-color' : 'text-app-income-color'"
                />
                <span
                  data-testid="vehicle-kpi-percentage"
                  class="text-muted-foreground text-sm font-normal whitespace-nowrap"
                >
                  {{ Math.abs(depreciationPercent).toFixed(1) }}%
                </span>
              </div>
              <div v-if="showRefValue" class="text-muted-foreground mt-0.5 text-xs tabular-nums">
                ≈
                <VehicleAmount
                  :formatted="formatAmountByCurrencyCode(Math.abs(refDepreciationAmount), baseCurrencyCode)"
                />
              </div>
              <div class="text-muted-foreground mt-1 text-xs">
                {{ $t('pages.vehicleDetails.depreciationCadence', { years: ownedYears.toFixed(1) }) }}
              </div>
            </div>

            <div
              v-if="vehicle.depreciationPreset !== DEPRECIATION_PRESET.manual"
              class="min-w-0 px-3 py-2.5 @lg/vehicle:p-4"
            >
              <div class="text-muted-foreground text-xs tracking-wider uppercase">
                {{ $t('pages.vehicleDetails.projectedFiveYear') }}
              </div>
              <VehicleAmount
                data-testid="vehicle-kpi-money"
                :formatted="formatAmountByCurrencyCode(projectedFiveYearValue, currencyCode)"
                class="mt-1 block text-lg font-semibold tabular-nums"
              />
              <div v-if="showRefValue" class="text-muted-foreground mt-0.5 text-xs tabular-nums">
                ≈ <VehicleAmount :formatted="formatAmountByCurrencyCode(refProjectedFiveYearValue, baseCurrencyCode)" />
              </div>
              <div class="text-muted-foreground mt-1 text-xs">
                {{
                  $t('pages.vehicleDetails.projectedExplain', {
                    pct: projectedFiveYearLossPct.toFixed(1),
                  })
                }}
              </div>
            </div>
          </section>

          <!-- Depreciation chart -->
          <section
            v-if="vehicle.depreciationPreset !== DEPRECIATION_PRESET.manual || vehicle.valuationSegments?.length"
            class="bg-card @container/chart-card rounded-2xl border p-5 shadow-xs @md/vehicle:p-6"
          >
            <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 class="text-base font-semibold tracking-tight">{{ $t('pages.vehicleDetails.chart.title') }}</h3>
                <p class="text-muted-foreground mt-1 text-xs">{{ $t('pages.vehicleDetails.chart.subtitle') }}</p>
              </div>
            </div>
            <DepreciationChart
              :timeline="showRefValue ? refDepreciationTimeline : depreciationTimeline"
              :purchase-date="purchaseDateAsDate"
              :override="showRefValue ? refOverrideAnchor : overrideAnchor"
              :today-date="todayDate"
              :salvage-floor="showRefValue ? refSalvageFloorValue : salvageFloorValue"
              :currency-code="showRefValue ? baseCurrencyCode : currencyCode"
            />
          </section>
        </TabsContent>
        <TabsContent value="activity">
          <OverrideHistoryCard
            v-if="vehicle.account"
            :account-id="vehicle.account.id"
            :currency-code="currencyCode"
            :readonly="!isOwner"
          />
        </TabsContent>
        <TabsContent value="information" class="space-y-4">
          <!-- Details sections -->
          <section class="grid gap-4 @lg/vehicle:grid-cols-2">
            <DetailsCard :title="$t('pages.vehicleDetails.sections.vehicle')" :icon="CarIcon">
              <DetailRow :label="$t('pages.vehicleDetails.vehicleClass')">
                {{
                  vehicle.vehicleType
                    ? $t(`forms.createVehicle.types.${vehicle.vehicleType}`)
                    : $t(VEHICLE_CLASS_TRANSLATION_KEYS[vehicle.vehicleClass])
                }}
              </DetailRow>
              <DetailRow :label="$t('pages.vehicleDetails.year')">{{ vehicle.year }}</DetailRow>
              <DetailRow v-if="isOwner && vehicle.licensePlate" :label="$t('forms.createVehicle.plateLabel')">{{
                vehicle.licensePlate
              }}</DetailRow>
              <DetailRow v-if="vehicle.trim" :label="$t('pages.vehicleDetails.trim')">{{ vehicle.trim }}</DetailRow>
              <DetailRow v-if="vehicle.currentMileage !== null" :label="$t('pages.vehicleDetails.currentMileage')">
                {{ vehicle.currentMileage.toLocaleString() }}
              </DetailRow>
            </DetailsCard>

            <DetailsCard :title="$t('pages.vehicleDetails.sections.depreciation')" :icon="TrendingDownIcon">
              <DetailRow :label="$t('pages.vehicleDetails.depreciationPreset')">
                {{ $t(DEPRECIATION_PRESET_TRANSLATION_KEYS[vehicle.depreciationPreset]) }}
              </DetailRow>
              <DetailRow
                v-if="vehicle.customAnnualRatePct !== null"
                :label="$t('pages.vehicleDetails.customAnnualRate')"
              >
                {{ vehicle.customAnnualRatePct }}%
              </DetailRow>
              <DetailRow
                v-if="vehicle.depreciationPreset !== DEPRECIATION_PRESET.manual"
                :label="$t('pages.vehicleDetails.salvageFloor')"
              >
                <span class="tabular-nums">{{ vehicle.salvageFloorPct }}%</span>
                <span class="text-muted-foreground ml-2 text-xs">
                  ≈ <VehicleAmount :formatted="formatAmountByCurrencyCode(salvageFloorValue, currencyCode)" />
                  <span v-if="showRefValue">
                    (<VehicleAmount :formatted="formatAmountByCurrencyCode(refSalvageFloorValue, baseCurrencyCode)" />)
                  </span>
                </span>
              </DetailRow>
              <DetailRow v-if="vehicle.valueAnchor !== null" :label="$t('pages.vehicleDetails.lastOverride')">
                <span class="tabular-nums">{{ formatAmountByCurrencyCode(vehicle.valueAnchor, currencyCode) }}</span>
                <span v-if="showRefValue && refValueAnchor !== null" class="text-muted-foreground ml-2 text-xs">
                  ≈ {{ formatAmountByCurrencyCode(refValueAnchor, baseCurrencyCode) }}
                </span>
                <span class="text-muted-foreground ml-2 text-xs">
                  {{ formatDisplayDate(vehicle.valueAnchorDate ?? vehicle.purchaseDate) }}
                </span>
              </DetailRow>
            </DetailsCard>
          </section>
        </TabsContent>
      </Tabs>

      <BalanceAdjustmentDialog
        v-if="isOwner && isOverrideOpen && vehicle.account"
        :account="vehicle.account"
        @close="onOverrideClosed"
      />

      <EditVehicleDialog v-if="isOwner" v-model:open="isEditOpen" :vehicle="vehicle" />

      <ResponsiveAlertDialog
        v-if="isOwner"
        v-model:open="isDeleteOpen"
        :confirm-label="$t('pages.vehicleDetails.deleteConfirm')"
        confirm-variant="destructive"
        @confirm="handleDelete"
      >
        <template #title>{{ $t('pages.vehicleDetails.deleteTitle') }}</template>
        <template #description>{{ $t('pages.vehicleDetails.deleteDescription') }}</template>
      </ResponsiveAlertDialog>
    </div>
  </PageWrapper>
</template>

<script setup lang="ts">
import { deleteVehicle, getVehicleById } from '@/api/vehicles';
import { VUE_QUERY_CACHE_KEYS, VUE_QUERY_GLOBAL_PREFIXES } from '@/common/const';
import {
  DEPRECIATION_PRESET_TRANSLATION_KEYS,
  VEHICLE_CLASS_TRANSLATION_KEYS,
} from '@/common/const/vehicle-classes-verbose';
import AccountLogo from '@/components/common/account-logo.vue';
import HintIcon from '@/components/common/hint-icon.vue';
import PageWrapper from '@/components/common/page-wrapper.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import EditVehicleDialog from '@/components/dialogs/edit-vehicle-dialog.vue';
import UiButton from '@/components/lib/ui/button/Button.vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/lib/ui/tabs';
import { getVehicleTypeIcon } from '@/components/forms/vehicle-class-options';
import { NotificationType, useNotificationCenter } from '@/components/notification-center';
import { useFormatCurrency } from '@/composable';
import { useAccountAccess } from '@/composable/use-account-access';
import { useDateLocale } from '@/composable/use-date-locale';
import { captureException } from '@/lib/sentry';
import AccountLogoPicker from '@/pages/account/components/account-logo-picker.vue';
import BalanceAdjustmentDialog from '@/pages/account/components/balance-adjustment-dialog.vue';
import DepreciationChart from '@/pages/accounts/components/vehicle-details/depreciation-chart.vue';
import DetailRow from '@/pages/accounts/components/vehicle-details/detail-row.vue';
import DetailsCard from '@/pages/accounts/components/vehicle-details/details-card.vue';
import OverrideHistoryCard from '@/pages/accounts/components/vehicle-details/override-history-card.vue';
import VehicleAmount from '@/pages/accounts/components/vehicle-details/vehicle-amount.vue';
import { buildDepreciationTimeline, getSalvageFloorValue } from '@/pages/accounts/utils/depreciation-math';
import { ROUTES_NAMES } from '@/routes/constants';
import { useAccountsStore, useCurrenciesStore } from '@/stores';
import { DEPRECIATION_PRESET } from '@bt/shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { ArrowDownRightIcon, ArrowUpRightIcon, CarIcon, Trash2Icon, TrendingDownIcon } from '@lucide/vue';
import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const PROJECTION_HORIZON_MONTHS = 144;
const FIVE_YEAR_PROJECTION_MONTHS = 60;
const DAYS_PER_YEAR = 365;

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const queryClient = useQueryClient();
const { addNotification } = useNotificationCenter();
const { formatAmountByCurrencyCode } = useFormatCurrency();

const vehicleId = computed(() => route.params.id as string);

const { data: vehicle, isLoading } = useQuery({
  // Include `vehicleId` (the ref) — not `.value` — so the query refetches when
  // the route param changes (sibling navigation between /vehicles/:id).
  queryKey: [...VUE_QUERY_CACHE_KEYS.vehicleDetail, vehicleId],
  queryFn: () => getVehicleById({ id: vehicleId.value }),
});

const { accountsRecord } = storeToRefs(useAccountsStore());
const linkedAccount = computed(() => (vehicle.value ? accountsRecord.value[vehicle.value.accountId] : undefined));
const access = useAccountAccess(linkedAccount);
// useAccountAccess treats a missing account as owned; hide owner actions until the account loads.
const isOwner = computed(() => !!linkedAccount.value && access.isOwner.value);

// Empty string is a safe placeholder — the page body only renders inside a
// `v-else` gated on `vehicle.account`, so this fallback never reaches the
// formatter at runtime, but keeps the type as `string` for the helpers.
const currencyCode = computed(() => vehicle.value?.account?.currencyCode ?? '');

const { baseCurrency } = storeToRefs(useCurrenciesStore());
const baseCurrencyCode = computed(() => baseCurrency.value?.currency?.code ?? '');

/**
 * Today's account→base FX rate, derived from the account's own current/ref balance pair.
 * Returns `null` when the rate can't be derived reliably (account missing, or current
 * balance has fully depreciated to zero) — callers gate ref-value display on that null
 * rather than silently rendering 1:1 across currencies. Historically-accurate ref values
 * would require per-date rates; today's rate is good enough for at-a-glance display.
 */
const fxRatio = computed<number | null>(() => {
  const account = vehicle.value?.account;
  if (!account || account.currentBalance === 0) return null;
  return account.refCurrentBalance / account.currentBalance;
});

const showRefValue = computed(
  () => baseCurrencyCode.value !== '' && baseCurrencyCode.value !== currencyCode.value && fxRatio.value !== null,
);

const refCurrentBalance = computed(() => vehicle.value?.account?.refCurrentBalance ?? 0);
const refPurchasePrice = computed(() => (vehicle.value?.purchasePrice ?? 0) * (fxRatio.value ?? 1));
const refValueAnchor = computed(() =>
  vehicle.value?.valueAnchor != null ? vehicle.value.valueAnchor * (fxRatio.value ?? 1) : null,
);

const depreciationAmount = computed(() => {
  if (!vehicle.value?.account) return 0;
  return vehicle.value.purchasePrice - vehicle.value.account.currentBalance;
});

const refDepreciationAmount = computed(() => refPurchasePrice.value - refCurrentBalance.value);

const depreciationPercent = computed(() => {
  if (!vehicle.value?.account || vehicle.value.purchasePrice === 0) return 0;
  return (depreciationAmount.value / vehicle.value.purchasePrice) * 100;
});

const depreciationDirection = computed<'up' | 'down'>(() => (depreciationAmount.value >= 0 ? 'down' : 'up'));

const todayDate = ref(new Date());

const purchaseDateAsDate = computed(() => (vehicle.value ? parseISO(vehicle.value.purchaseDate) : new Date()));

const overrideAnchor = computed<{ value: number; date: Date } | null>(() => {
  if (!vehicle.value || vehicle.value.valueAnchor === null || vehicle.value.valueAnchorDate === null) {
    return null;
  }
  return { value: vehicle.value.valueAnchor, date: parseISO(vehicle.value.valueAnchorDate) };
});

const salvageFloorValue = computed(() =>
  vehicle.value
    ? getSalvageFloorValue({
        anchorValue: vehicle.value.valuationSegments?.at(-1)?.value ?? vehicle.value.purchasePrice,
        salvageFloorPct: vehicle.value.salvageFloorPct,
      })
    : 0,
);

const depreciationTimeline = computed(() => {
  if (!vehicle.value) return [];
  return buildDepreciationTimeline({
    purchase: { value: vehicle.value.purchasePrice, date: purchaseDateAsDate.value },
    override: overrideAnchor.value,
    vehicleClass: vehicle.value.vehicleClass,
    preset: vehicle.value.depreciationPreset,
    customAnnualRatePct: vehicle.value.customAnnualRatePct,
    salvageFloorPct: vehicle.value.salvageFloorPct,
    monthsHorizon: PROJECTION_HORIZON_MONTHS,
    valuationSegments: vehicle.value.valuationSegments,
  });
});

const ownedYears = computed(() => {
  if (!vehicle.value) return 0;
  const days = differenceInCalendarDays(todayDate.value, parseISO(vehicle.value.purchaseDate));
  return Math.max(0, days / DAYS_PER_YEAR);
});

const projectedFiveYearValue = computed(() => {
  const tl = depreciationTimeline.value;
  if (tl.length === 0) return 0;
  const targetMs = addMonths(todayDate.value, FIVE_YEAR_PROJECTION_MONTHS).getTime();
  const future = tl.find((p) => p.date.getTime() >= targetMs);
  return future ? future.value : tl[tl.length - 1]!.value;
});

const projectedFiveYearLossPct = computed(() => {
  if (!vehicle.value?.account || vehicle.value.account.currentBalance === 0) return 0;
  const current = vehicle.value.account.currentBalance;
  return ((current - projectedFiveYearValue.value) / current) * 100;
});

const refSalvageFloorValue = computed(() => salvageFloorValue.value * (fxRatio.value ?? 1));
const refProjectedFiveYearValue = computed(() => projectedFiveYearValue.value * (fxRatio.value ?? 1));

const refDepreciationTimeline = computed(() =>
  depreciationTimeline.value.map((p) => ({ ...p, value: p.value * (fxRatio.value ?? 1) })),
);
const refOverrideAnchor = computed<{ value: number; date: Date } | null>(() =>
  overrideAnchor.value
    ? { value: overrideAnchor.value.value * (fxRatio.value ?? 1), date: overrideAnchor.value.date }
    : null,
);

const { format } = useDateLocale();
const formatDisplayDate = (iso: string) => format(parseISO(iso), 'PPP');
const activeVehicleTab = ref('summary');
const vehicleIcon = computed(() =>
  vehicle.value
    ? getVehicleTypeIcon({ type: vehicle.value.vehicleType, legacyClass: vehicle.value.vehicleClass })
    : CarIcon,
);
const vehicleTypeLabel = computed(() => {
  if (!vehicle.value) return '';
  return vehicle.value.vehicleType
    ? t(`forms.createVehicle.types.${vehicle.value.vehicleType}`)
    : t(VEHICLE_CLASS_TRANSLATION_KEYS[vehicle.value.vehicleClass]);
});
const valuationExplanation = computed(() =>
  t(
    vehicle.value?.depreciationPreset === DEPRECIATION_PRESET.manual
      ? 'forms.createVehicle.manualHint'
      : vehicle.value?.depreciationPreset === DEPRECIATION_PRESET.straightLine
        ? 'forms.createVehicle.accountingHint'
        : 'pages.vehicleDetails.estimateDisclaimer',
  ),
);

const isOverrideOpen = ref(false);
const isEditOpen = ref(false);
const isDeleteOpen = ref(false);

const onOverrideClosed = () => {
  isOverrideOpen.value = false;
  // All three vehicle cache keys are prefixed with `transactionChange` (see
  // common/const/vue-query.ts), so the predicate invalidation covers them too —
  // no need for explicit per-key invalidations here.
  queryClient.invalidateQueries({
    predicate: (q) => (q.queryKey as string[]).includes(VUE_QUERY_GLOBAL_PREFIXES.transactionChange),
  });
};

const deleteMutation = useMutation({ mutationFn: deleteVehicle });

const handleDelete = async () => {
  if (!vehicle.value) return;
  try {
    await deleteMutation.mutateAsync({ id: vehicle.value.id });
    addNotification({
      text: t('pages.vehicleDetails.deleteSuccess'),
      type: NotificationType.success,
    });
    queryClient.invalidateQueries({
      predicate: (q) => (q.queryKey as string[]).includes(VUE_QUERY_GLOBAL_PREFIXES.transactionChange),
    });
    router.push({ name: ROUTES_NAMES.accounts });
  } catch (error) {
    addNotification({
      text: t('pages.vehicleDetails.deleteError'),
      type: NotificationType.error,
    });
    captureException({ error, context: { source: 'vehicleDetailsDelete', vehicleId: vehicle.value.id } });
  }
};
</script>
