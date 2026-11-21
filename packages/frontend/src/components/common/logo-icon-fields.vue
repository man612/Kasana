<script setup lang="ts">
import BrandLogo from '@/components/common/brand-logo.vue';
import IconPickerDropdown from '@/components/common/icons/icon-picker-dropdown.vue';
import LogoColorPicker from '@/components/common/logo-color-picker.vue';

const icon = defineModel<string>('icon', { required: true });
const color = defineModel<string>('color', { required: true });
withDefaults(defineProps<{ name: string; autofocus?: boolean; allowClear?: boolean }>(), {
  autofocus: true,
  allowClear: true,
});
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <div class="flex min-w-0 items-start gap-2">
      <slot name="preview">
        <BrandLogo :domain="null" :name="name" :icon="icon || null" :color="color" class="size-11 shrink-0 text-lg" />
      </slot>
      <IconPickerDropdown v-model="icon" :autofocus="autofocus" :allow-clear="allowClear" class="min-w-0 flex-1" />
    </div>
    <LogoColorPicker v-model="color" />
  </div>
</template>
