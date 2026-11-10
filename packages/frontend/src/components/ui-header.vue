<template>
  <div ref="headerRef">
    <DemoBanner />
    <TrialBanner />
    <div
      class="shadow-header border-border @container/header-bar flex items-center justify-between border-b px-4 py-2 sm:px-6"
    >
      <div class="flex items-center gap-4">
        <Button
          v-if="backDestination"
          type="button"
          variant="ghost"
          size="icon-sm"
          class="shrink-0"
          :aria-label="$t('common.actions.back')"
          :title="$t('common.actions.back')"
          @click="goBack"
        >
          <ArrowLeftIcon class="size-4" />
        </Button>
        <template v-if="isMobileView">
          <Sheet.Sheet :open="isMobileSheetOpen" @update:open="isMobileSheetOpen = $event">
            <Sheet.SheetTrigger as-child>
              <Button size="icon-sm" variant="secondary" class="shrink-0" :aria-label="t('kasana.navigation.openMenu')">
                <MenuIcon class="size-4" />
              </Button>
            </Sheet.SheetTrigger>
            <Sheet.SheetContent
              side="left"
              :class="[
                'xs:w-3/4 w-full overflow-y-auto px-0',
                'data-[state=closed]:duration-200 data-[state=open]:duration-300',
              ]"
            >
              <Sheet.SheetTitle></Sheet.SheetTitle>
              <Sheet.SheetDescription></Sheet.SheetDescription>

              <Sidebar mobile-view />
            </Sheet.SheetContent>
          </Sheet.Sheet>
        </template>

        <div class="flex items-center gap-px">
          <ManageTransactionDialog v-model:open="isCreateTransactionDialogOpen" :prefill="createTransactionPrefill">
            <Button variant="default" size="sm" class="rounded-r-none">
              <PlusIcon class="size-4" />
              {{ isMobileView ? $t('header.add') : $t('header.newTransaction') }}
            </Button>
          </ManageTransactionDialog>

          <Popover.Popover v-model:open="isAddMenuOpen">
            <Popover.PopoverTrigger as-child>
              <Button variant="default" size="sm" class="rounded-l-none px-2" :aria-label="$t('header.moreActions')">
                <ChevronDownIcon class="size-4" />
              </Button>
            </Popover.PopoverTrigger>
            <Popover.PopoverContent class="grid w-72 gap-0.5 p-1.5" align="start">
              <RouterLink :to="{ name: ROUTES_NAMES.settingsDataManagement }" @click="isAddMenuOpen = false">
                <Button variant="ghost" class="h-auto w-full justify-start gap-3 p-2 text-left whitespace-normal">
                  <span
                    class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md"
                  >
                    <ImportIcon class="size-4" />
                  </span>
                  <span class="grid">
                    <span class="text-sm font-semibold">{{ $t('header.importData') }}</span>
                    <span class="text-muted-foreground text-xs font-normal">{{ $t('header.importDataHint') }}</span>
                  </span>
                </Button>
              </RouterLink>

              <Button
                v-if="!userStore.isDemo"
                variant="ghost"
                class="h-auto w-full justify-start gap-3 p-2 text-left whitespace-normal"
                @click="openAttachInvoice"
              >
                <span
                  class="bg-primary/10 text-primary-text flex size-9 shrink-0 items-center justify-center rounded-md"
                >
                  <ReceiptTextIcon class="size-4" />
                </span>
                <span class="grid">
                  <span class="text-sm font-semibold">{{ $t('header.attachInvoice') }}</span>
                  <span class="text-muted-foreground text-xs font-normal">{{ $t('header.attachInvoiceHint') }}</span>
                </span>
              </Button>
            </Popover.PopoverContent>
          </Popover.Popover>
        </div>

        <AttachInvoiceDialog v-if="isAttachInvoiceMounted" v-model:open="isAttachInvoiceOpen" />
      </div>

      <div class="ml-auto flex items-center gap-2">
        <NotificationsPopover />

        <DesktopOnlyTooltip :content="isSettingsRoute ? t('kasana.settings.exit') : t('header.settings')">
          <Button
            :variant="isSettingsRoute ? 'ghost-primary' : 'secondary'"
            size="icon"
            :class="isSettingsRoute && 'bg-primary/15 text-primary-text ring-1 ring-primary/50'"
            :aria-label="isSettingsRoute ? t('kasana.settings.exit') : t('header.settings')"
            :aria-pressed="isSettingsRoute"
            @click="toggleSettings"
          >
            <SettingsIcon class="size-4" />
          </Button>
        </DesktopOnlyTooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TrialBanner from '@/components/billing/trial-banner.vue';
import DemoBanner from '@/components/demo/demo-banner.vue';
import ManageTransactionDialog from '@/components/dialogs/manage-transaction/index.vue';
import Button from '@/components/lib/ui/button/Button.vue';
import * as Popover from '@/components/lib/ui/popover';
import * as Sheet from '@/components/lib/ui/sheet';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import NotificationsPopover from '@/components/notifications-popover/index.vue';
import Sidebar from '@/components/sidebar/index.vue';
import {
  createTransactionPrefill,
  isCreateTransactionDialogOpen,
} from '@/composable/global-state/create-transaction-dialog';
import { isMobileSheetOpen } from '@/composable/global-state/mobile-sheet';
import { useCssVarFromElementSize } from '@/composable/use-css-var-from-element-size';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { ROUTES_NAMES } from '@/routes/constants';
import { useUserStore } from '@/stores';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ImportIcon,
  MenuIcon,
  PlusIcon,
  ReceiptTextIcon,
  SettingsIcon,
} from '@lucide/vue';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';

const AttachInvoiceDialog = defineAsyncComponent(() => import('@/components/dialogs/attach-invoice/index.vue'));

const userStore = useUserStore();
const isAddMenuOpen = ref(false);
const isAttachInvoiceMounted = ref(false);
const isAttachInvoiceOpen = ref(false);

const openAttachInvoice = () => {
  isAddMenuOpen.value = false;
  isAttachInvoiceMounted.value = true;
  isAttachInvoiceOpen.value = true;
};

const { elementRef: headerRef } = useCssVarFromElementSize({
  cssVars: [{ cssVarName: '--header-height' }],
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const isSettingsRoute = computed(() => String(route.name ?? '').startsWith(ROUTES_NAMES.settings));

// Detail pages need a visible way back even after a deep link or direct refresh.
// Keep the fallback deterministic and safe when browser history has no prior app route.
const detailParents: Record<string, string> = {
  [ROUTES_NAMES.account]: ROUTES_NAMES.accounts,
  [ROUTES_NAMES.accountsVehicleDetails]: ROUTES_NAMES.accounts,
  [ROUTES_NAMES.investmentAccount]: ROUTES_NAMES.investments,
  [ROUTES_NAMES.budgetPlan]: ROUTES_NAMES.budget,
  [ROUTES_NAMES.plannedSubscriptionDetails]: ROUTES_NAMES.plannedSubscriptions,
  [ROUTES_NAMES.plannedTrackerDetails]: ROUTES_NAMES.plannedTrackers,
};
const backDestination = computed(() => detailParents[String(route.name ?? '')] ?? null);
const goBack = () => {
  // Vue Router records the previous in-app location on its history state.
  const previous = router.options.history.state.back;
  if (typeof previous === 'string' && previous.startsWith('/') && previous !== route.fullPath) {
    router.back();
  } else if (backDestination.value) {
    void router.push({ name: backDestination.value });
  }
};
const previousAppRoute = ref<string | null>(null);
watch(
  () => route.fullPath,
  () => {
    if (!isSettingsRoute.value) previousAppRoute.value = route.fullPath;
  },
  { immediate: true },
);
const toggleSettings = () => {
  if (isSettingsRoute.value) {
    void router.push(previousAppRoute.value ?? { name: ROUTES_NAMES.home });
  } else {
    void router.push({ name: ROUTES_NAMES.settings });
  }
};
const isMobileView = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
watch(route, () => {
  isMobileSheetOpen.value = false;
});
</script>
