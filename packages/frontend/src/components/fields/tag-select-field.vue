<script setup lang="ts">
import { availableTagSuggestions, isCoreTagName, type TagSuggestion } from '@/common/const/indonesian-tag-suggestions';
import TagIcon from '@/components/common/icons/tag-icon.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import FieldError from '@/components/fields/components/field-error.vue';
import FieldLabel from '@/components/fields/components/field-label.vue';
import * as Dialog from '@/components/lib/ui/dialog';
import { useTagsStore } from '@/stores';
import { type TagModel } from '@bt/shared/types';
import { CheckIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    label?: string;
    modelValue?: string[];
    placeholder?: string;
    errorMessage?: string;
    disabled?: boolean;
  }>(),
  { modelValue: () => [], disabled: false },
);
const emit = defineEmits<{ 'update:model-value': [value: string[]] }>();
const { t, locale } = useI18n();
const tagsStore = useTagsStore();
const { tags } = storeToRefs(tagsStore);
const isOpen = ref(false);
const query = ref('');
const isCreatingSuggestion = ref(false);
const suggestionError = ref('');
const isDeleteConfirmOpen = ref(false);
const pendingTagDelete = ref<TagModel | null>(null);
const isDeleting = ref(false);

const selectedIds = computed(() => new Set(props.modelValue ?? []));
const selectedTags = computed(() =>
  (props.modelValue ?? [])
    .map((id) => tags.value.find((tag) => tag.id === id))
    .filter((tag): tag is TagModel => tag !== undefined),
);
const filteredTags = computed(() => {
  const search = query.value.trim().toLocaleLowerCase(locale.value);
  return search ? tags.value.filter((tag) => tag.name.toLocaleLowerCase(locale.value).includes(search)) : tags.value;
});
const recommendedTags = computed(() =>
  locale.value === 'id'
    ? availableTagSuggestions(
        tags.value.map((tag) => tag.name),
        query.value.trim().toLocaleLowerCase('id-ID'),
      )
    : [],
);
const openList = () => {
  if (props.disabled) return;
  query.value = '';
  isOpen.value = true;
};
watch(isOpen, (open) => {
  if (!open) query.value = '';
});
const toggleTag = (tag: TagModel) => {
  const ids = [...(props.modelValue ?? [])];
  const index = ids.indexOf(tag.id);
  if (index < 0) ids.push(tag.id);
  else ids.splice(index, 1);
  emit('update:model-value', ids);
};
// Selecting and deselecting are reversible edits to this transaction, not tag deletion.
const requestTagToggle = (tag: TagModel) => {
  if (!props.disabled) toggleTag(tag);
};
const requestDelete = (tag: TagModel) => {
  if (props.disabled || isCoreTagName(tag.name)) return;
  pendingTagDelete.value = tag;
  isDeleteConfirmOpen.value = true;
};
const confirmDelete = async () => {
  const tag = pendingTagDelete.value;
  if (!tag || isCoreTagName(tag.name) || isDeleting.value) return;
  isDeleting.value = true;
  suggestionError.value = '';
  try {
    await tagsStore.deleteTag({ id: tag.id });
    if (selectedIds.value.has(tag.id)) {
      emit(
        'update:model-value',
        (props.modelValue ?? []).filter((id) => id !== tag.id),
      );
    }
    pendingTagDelete.value = null;
  } catch {
    suggestionError.value = t('fields.tagSelect.deleteError');
  } finally {
    isDeleting.value = false;
  }
};
const createSuggestedTag = async (suggestion: TagSuggestion) => {
  if (props.disabled || isCreatingSuggestion.value) return;
  suggestionError.value = '';
  isCreatingSuggestion.value = true;
  try {
    const existing = tags.value.find(
      (tag) => tag.name.toLocaleLowerCase('id-ID') === suggestion.name.toLocaleLowerCase('id-ID'),
    );
    const created = existing ?? (await tagsStore.createTag({ name: suggestion.name, color: suggestion.color }));
    if (!selectedIds.value.has(created.id)) toggleTag(created);
  } catch {
    suggestionError.value = t('fields.tagSelect.createError');
  } finally {
    isCreatingSuggestion.value = false;
  }
};
defineExpose({ open: openList });
</script>

<template>
  <FieldLabel :label="label" only-template>
    <template v-if="$slots['label-right']" #label-right><slot name="label-right" /></template>
    <button
      type="button"
      :disabled="disabled"
      data-testid="tag-picker-trigger"
      class="border-input bg-input-background hover:bg-muted/50 focus-visible:ring-ring flex min-h-9 w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
      @click="openList"
    >
      <span v-if="!selectedTags.length" class="text-muted-foreground min-w-0 flex-1 truncate">
        {{ placeholder ?? t('fields.tagSelect.placeholder') }}
      </span>
      <span v-else class="flex min-w-0 flex-1 flex-wrap gap-1">
        <span
          v-for="tag in selectedTags"
          :key="tag.id"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
          :style="{ backgroundColor: tag.color }"
        >
          <TagIcon v-if="tag.icon" :name="tag.icon" class="size-3" />
          {{ tag.name }}
        </span>
      </span>
      <ChevronRightIcon class="text-muted-foreground size-4 shrink-0" />
    </button>
    <FieldError :error-message="errorMessage" />
  </FieldLabel>
  <Dialog.Dialog v-model:open="isOpen">
    <Dialog.DialogContent
      blur-overlay
      data-testid="tag-picker-dialog"
      class="max-h-[min(86dvh,660px)] w-[calc(100vw-2rem)] max-w-xl gap-0 overflow-hidden p-0"
    >
      <div class="border-border border-b px-4 py-4 pr-14">
        <Dialog.DialogTitle class="text-base font-semibold">{{ t('fields.tagSelect.dialogTitle') }}</Dialog.DialogTitle>
        <Dialog.DialogDescription class="text-muted-foreground mt-1 text-xs">
          {{ t('fields.tagSelect.dialogHint') }}
        </Dialog.DialogDescription>
      </div>
      <div class="border-border border-b p-3">
        <input
          v-model="query"
          type="search"
          autofocus
          :placeholder="t('fields.tagSelect.searchPlaceholder')"
          class="border-input bg-input-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
      <div class="max-h-[min(59dvh,460px)] min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
        <section>
          <h3 class="text-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            {{ t('fields.tagSelect.existingTitle') }}
          </h3>
          <p v-if="!filteredTags.length" class="text-muted-foreground py-3 text-xs">
            {{ t('fields.tagSelect.noTagsAvailable') }}
          </p>
          <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <div
              v-for="tag in filteredTags"
              :key="tag.id"
              class="border-border/60 hover:bg-muted/40 focus-within:border-primary/40 flex min-w-0 items-center gap-1 rounded-lg border px-2 py-1 transition-colors"
            >
              <button
                type="button"
                class="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left"
                :aria-pressed="selectedIds.has(tag.id)"
                @click="requestTagToggle(tag)"
              >
                <span class="size-3.5 shrink-0 rounded-full" :style="{ backgroundColor: tag.color }" />
                <span class="min-w-0 flex-1 truncate text-sm">{{ tag.name }}</span>
                <CheckIcon v-if="selectedIds.has(tag.id)" class="text-primary size-4" />
              </button>
              <button
                v-if="!isCoreTagName(tag.name)"
                type="button"
                class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-8 items-center justify-center rounded-md"
                :aria-label="t('fields.tagSelect.deleteTagLabel', { name: tag.name })"
                @click="requestDelete(tag)"
              >
                <Trash2Icon class="size-4" />
              </button>
            </div>
          </div>
        </section>
        <section v-if="recommendedTags.length" class="border-border border-t pt-3">
          <h3 class="mb-1 text-xs font-semibold">{{ t('fields.tagSelect.suggestedTitle') }}</h3>
          <p class="text-muted-foreground mb-2 text-xs">{{ t('fields.tagSelect.suggestedHint') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="suggestion in recommendedTags"
              :key="suggestion.name"
              type="button"
              :disabled="disabled || isCreatingSuggestion"
              class="focus-visible:ring-ring inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white transition-opacity hover:opacity-85 focus-visible:ring-2 disabled:opacity-50"
              :style="{ backgroundColor: suggestion.color }"
              data-testid="suggested-tag"
              @click="createSuggestedTag(suggestion)"
            >
              <PlusIcon class="size-3.5" />{{ suggestion.name }}
            </button>
          </div>
        </section>
        <p v-if="suggestionError" class="text-destructive text-xs" role="alert">{{ suggestionError }}</p>
      </div>
      <div class="border-border flex justify-end border-t px-4 py-3">
        <button
          type="button"
          class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          @click="isOpen = false"
        >
          {{ t('fields.tagSelect.done') }}
        </button>
      </div>
    </Dialog.DialogContent>
  </Dialog.Dialog>
  <ResponsiveAlertDialog
    v-model:open="isDeleteConfirmOpen"
    :confirm-label="t('fields.tagSelect.deleteTagAction')"
    confirm-variant="destructive"
    :confirm-disabled="isDeleting"
    @confirm="confirmDelete"
    @cancel="pendingTagDelete = null"
  >
    <template #title>{{ t('fields.tagSelect.deleteTagTitle') }}</template>
    <template #description>{{ t('fields.tagSelect.deleteTagDetail', { name: pendingTagDelete?.name }) }}</template>
  </ResponsiveAlertDialog>
</template>
