<template>
  <Card class="w-full max-w-none">
    <CardHeader class="border-b">
      <h2 class="mb-2 text-2xl font-semibold">{{ $t('settings.appearance.title') }}</h2>
      <p class="text-sm opacity-80">{{ $t('settings.appearance.description') }}</p>
    </CardHeader>

    <CardContent class="mt-6 flex flex-col gap-6">
      <!-- Theme Section -->
      <div>
        <h3 class="mb-2 text-lg font-medium">{{ $t('settings.appearance.theme.title') }}</h3>
        <p class="mb-4 text-sm leading-relaxed">
          {{ $t('settings.appearance.theme.description') }}
        </p>

        <div class="flex flex-wrap gap-2">
          <Button
            v-for="option in themeOptions"
            :key="option.value"
            :variant="themePreference === option.value ? 'default' : 'outline'"
            class="relative overflow-hidden transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-out active:scale-[0.97] motion-reduce:transition-none"
            size="sm"
            @click="setThemePreference(option.value)"
          >
            <component
              :is="option.icon"
              class="size-4 transition-transform duration-200"
              :class="themePreference === option.value && 'scale-110'"
            />
            <span>{{ $t(option.labelKey) }}</span>
            <Transition name="lajur-form-copy">
              <CheckIcon v-if="themePreference === option.value" class="size-3.5 shrink-0" aria-hidden="true" />
            </Transition>
          </Button>
        </div>
      </div>

      <Separator />

      <!-- Accent color is separate from light/dark theme. -->
      <div>
        <h3 class="mb-2 text-lg font-medium">{{ $t('settings.appearance.accent.title') }}</h3>
        <p class="mb-4 text-sm leading-relaxed">{{ $t('settings.appearance.accent.description') }}</p>
        <div class="flex flex-wrap gap-2" role="group" :aria-label="$t('settings.appearance.accent.title')">
          <button
            v-for="option in ACCENT_OPTIONS"
            :key="option.value"
            type="button"
            :aria-pressed="accentTheme === option.value"
            class="border-input hover:bg-accent focus-visible:ring-ring inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-[background-color,border-color,color,box-shadow,transform] duration-250 ease-out focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none"
            :class="accentTheme === option.value && 'border-primary bg-primary/10 text-primary-text'"
            @click="updateAccentTheme(option.value)"
          >
            <span
              class="size-4 shrink-0 rounded-full ring-1 ring-black/10"
              :style="{ backgroundColor: option.swatch }"
              aria-hidden="true"
            />
            {{ $t('settings.appearance.accent.' + option.value) }}
            <span class="relative inline-flex size-4 shrink-0 items-center justify-center">
              <Transition name="lajur-form-copy">
                <CheckIcon v-if="accentTheme === option.value" class="absolute size-4" aria-hidden="true" />
              </Transition>
            </span>
          </button>
        </div>
      </div>

      <Separator />

      <!-- Sidebar Sections -->
      <div>
        <h3 class="mb-2 text-lg font-medium">{{ $t('settings.appearance.sidebar.title') }}</h3>
        <p class="mb-4 text-sm leading-relaxed">
          {{ $t('settings.appearance.sidebar.description') }}
        </p>

        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between gap-4">
            <span class="flex items-center gap-2 text-sm">
              <LayersIcon class="text-muted-foreground size-4 shrink-0" />
              {{ $t('sidebar.accountsView.bankAccounts') }}
            </span>
            <HintIcon :content="$t('settings.appearance.sidebar.alwaysVisibleTooltip')" />
          </div>

          <div
            v-for="section in TOGGLEABLE_SIDEBAR_SECTIONS"
            :key="section.key"
            class="flex items-center justify-between gap-4"
          >
            <span class="flex items-center gap-2 text-sm">
              <component :is="section.icon" class="text-muted-foreground size-4 shrink-0" />
              {{ $t(section.labelKey) }}
            </span>
            <Switch
              :model-value="sidebarSections[section.key]"
              :disabled="isUpdating"
              @update:model-value="(v) => toggleSection(section.key, !!v)"
            />
          </div>
        </div>
      </div>

      <Separator />

      <!-- Sidebar Navigation -->
      <div>
        <h3 class="mb-2 text-lg font-medium">{{ $t('settings.appearance.sidebarNav.title') }}</h3>
        <p class="mb-4 text-sm leading-relaxed">
          {{ $t('settings.appearance.sidebarNav.description') }}
        </p>

        <div class="flex flex-col gap-3">
          <div
            v-for="item in TOGGLEABLE_ACCOUNTS_NAV_CHILDREN"
            :key="item.settingKey"
            class="flex items-center justify-between gap-4"
          >
            <span class="flex items-center gap-2 text-sm">
              <component :is="item.icon" class="text-muted-foreground size-4 shrink-0" />
              {{ $t(item.labelKey) }}
            </span>
            <Switch
              :model-value="
                item.settingKey === 'venture'
                  ? userSettings?.sidebarNav?.venture === true
                  : userSettings?.sidebarNav?.[item.settingKey] !== false
              "
              :disabled="isPatching"
              @update:model-value="(v) => patch({ sidebarNav: { [item.settingKey]: !!v } })"
            />
          </div>
        </div>
      </div>

      <Separator />

      <!-- Currency symbol -->
      <div>
        <h3 class="mb-2 text-lg font-medium">{{ $t('settings.appearance.currency.title') }}</h3>
        <p class="mb-4 text-sm leading-relaxed">
          {{ $t('settings.appearance.currency.description') }}
        </p>

        <div class="flex items-center justify-between gap-4">
          <span class="flex items-center gap-2 text-sm">
            <CoinsIcon class="text-muted-foreground size-4 shrink-0" />
            {{ $t('settings.appearance.currency.narrowSymbol') }}
          </span>
          <Switch
            :model-value="userSettings?.currencyDisplay === 'narrowSymbol'"
            :disabled="isPatching"
            @update:model-value="(v) => patch({ currencyDisplay: v ? 'narrowSymbol' : 'symbol' })"
          />
        </div>
      </div>

      <template v-if="isSupportButtonAvailable">
        <Separator />

        <!-- Header -->
        <div>
          <h3 class="mb-2 text-lg font-medium">{{ $t('settings.appearance.header.title') }}</h3>
          <p class="mb-4 text-sm leading-relaxed">
            {{ $t('settings.appearance.header.description') }}
          </p>

          <div class="flex items-center justify-between gap-4">
            <span class="flex items-center gap-2 text-sm">
              <HeartIcon class="text-heart size-4 shrink-0 fill-current" />
              {{ $t('settings.appearance.header.supportButton') }}
            </span>
            <Switch
              :model-value="isSupportButtonVisible"
              :disabled="isSupportButtonUpdating"
              @update:model-value="(v) => setSupportButtonVisible(!!v)"
            />
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import HintIcon from '@/components/common/hint-icon.vue';
import { ThemePreference, setThemePreference, themePreference } from '@/common/utils/color-theme';
import { ACCENT_OPTIONS, accentTheme, setAccentTheme, type AccentTheme } from '@/common/utils/accent-theme';
import ResponsiveTooltip from '@/components/common/responsive-tooltip.vue';
import Button from '@/components/lib/ui/button/Button.vue';
import { Card, CardContent, CardHeader } from '@/components/lib/ui/card';
import { Separator } from '@/components/lib/ui/separator';
import { TOGGLEABLE_ACCOUNTS_NAV_CHILDREN } from '@/components/sidebar/nav-items';
import { Switch } from '@/components/lib/ui/switch';
import { useUserSettings } from '@/composable/data-queries/user-settings';
import { TOGGLEABLE_SIDEBAR_SECTIONS, useSidebarSections } from '@/composable/use-sidebar-sections';
import { useSupportButton } from '@/composable/use-support-button';
import { CheckIcon, CoinsIcon, HeartIcon, LayersIcon, MonitorIcon, MoonStarIcon, SunIcon } from '@lucide/vue';
import { type Component } from 'vue';

const { sidebarSections, toggleSection, isUpdating } = useSidebarSections();
const {
  isSupportButtonAvailable,
  isSupportButtonVisible,
  setSupportButtonVisible,
  isUpdating: isSupportButtonUpdating,
} = useSupportButton();
const { data: userSettings, patch, isPatching } = useUserSettings();

function updateAccentTheme(value: AccentTheme): void {
  setAccentTheme(value);
  // The shared settings endpoint persists this per user for reloads and other devices.
  patch({ accentTheme: value });
}

interface ThemeOption {
  value: ThemePreference;
  labelKey: string;
  icon: Component;
}

const themeOptions: ThemeOption[] = [
  { value: ThemePreference.light, labelKey: 'themeSelector.light', icon: SunIcon },
  { value: ThemePreference.dark, labelKey: 'themeSelector.dark', icon: MoonStarIcon },
  { value: ThemePreference.system, labelKey: 'themeSelector.system', icon: MonitorIcon },
];
</script>
