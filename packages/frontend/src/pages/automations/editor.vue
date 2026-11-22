<script setup lang="ts">
import HintIcon from '@/components/common/hint-icon.vue';
import LayoutCollapse from '@/components/common/layout-collapse.vue';
import ResourceNotFound from '@/components/common/resource-not-found.vue';
import ResponsiveAlertDialog from '@/components/common/responsive-alert-dialog.vue';
import InputField from '@/components/fields/input-field.vue';
import { Button } from '@/components/lib/ui/button';
import { Card } from '@/components/lib/ui/card';
import { PillTabs } from '@/components/lib/ui/pill-tabs';
import { Switch } from '@/components/lib/ui/switch';
import { DesktopOnlyTooltip } from '@/components/lib/ui/tooltip';
import { useNotificationCenter } from '@/components/notification-center';
import {
  useCreateAutomation,
  useTransactionAutomation,
  useUpdateAutomation,
} from '@/composable/data-queries/transaction-automations';
import { useKeyboardViewport } from '@/composable/use-keyboard-viewport';
import { CUSTOM_BREAKPOINTS, useWindowBreakpoints } from '@/composable/window-breakpoints';
import { extractApiErrorMessage } from '@/js/errors';
import { captureException } from '@/lib/sentry';
import { ROUTES_NAMES } from '@/routes';
import { useTagsStore } from '@/stores';
import {
  type AutomationAction,
  type AutomationConditions,
  type AutomationRefType,
  type RecordId,
} from '@bt/shared/types';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  HistoryIcon,
  ChevronDownIcon,
  ListFilterIcon,
  ListChecksIcon,
} from '@lucide/vue';
import { computed, reactive, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

import ActionsBuilder from './components/actions-builder.vue';
import ApplyToHistoryDialog from './components/apply-to-history-dialog.vue';
import AutomationChipTrack from './components/automation-chip-track.vue';
import { buildAutomationChips } from './components/automation-chips';
import AutomationGuide from './components/automation-guide.vue';
import { provideAutomationRefs } from './components/automation-refs';
import {
  type AutomationValidationError,
  actionError,
  conditionError,
  nameError,
  trimKeywords,
} from './components/automation-validation';
import { ACTION_DEFAULTS, type AutomationActionDraft, CONDITION_REGISTRY } from './components/condition-registry';
import ConditionsBuilder from './components/conditions-builder.vue';
import PreviewPanel from './components/preview-panel.vue';
import RailSection from './components/rail-section.vue';

const SKELETON_ROW_COUNT = 4;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { addSuccessNotification, addErrorNotification } = useNotificationCenter();

useTagsStore()
  .loadTags()
  .catch((error) => captureException({ error, context: { scope: 'automations-editor:load-tags' } }));

const formId = useId();
const isMobile = useWindowBreakpoints(CUSTOM_BREAKPOINTS.uiMobile);
const keyboard = useKeyboardViewport(isMobile);
const visibleEditorHeight = computed(() =>
  keyboard.value
    ? {
        height: `calc(${keyboard.value.height}px - var(--header-height, 3.5rem))`,
      }
    : undefined,
);

const ruleId = computed(() => (route.params.id as RecordId | undefined) || undefined);
const isCreate = computed(() => !ruleId.value);
const { automation, isFetched, isError } = useTransactionAutomation({ id: ruleId });

const form = reactive({
  name: '',
  isEnabled: true,
  conditions: { match: 'all', items: [CONDITION_REGISTRY.note.defaultValue()] } as AutomationConditions,
  actions: [ACTION_DEFAULTS.set_category()] as AutomationActionDraft[],
});

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizedConditions = computed<AutomationConditions>(() => ({
  match: form.conditions.items.length === 1 ? 'all' : form.conditions.match,
  items: form.conditions.items.map((item) =>
    item.field === 'note' || item.field === 'merchant' ? { ...item, value: trimKeywords({ value: item.value }) } : item,
  ),
}));
const serializeDraft = () =>
  JSON.stringify({
    ...form,
    name: form.name.trim(),
    conditions: normalizedConditions.value,
  });
const snapshot = ref('');
const isLoaded = ref(false);

watch(
  [isFetched, automation],
  () => {
    if (isLoaded.value) return;
    const rule = automation.value;
    if (!isCreate.value) {
      if (!rule) return;
      form.name = rule.name;
      form.isEnabled = rule.isEnabled;
      form.conditions = clone(rule.conditions);
      form.actions = clone(rule.actions);
    }
    snapshot.value = serializeDraft();
    isLoaded.value = true;
  },
  { immediate: true },
);

const { refVisual, isReady: isRefsReady } = provideAutomationRefs();

const hasMissingRef = ({ type, ids }: { type: AutomationRefType; ids: RecordId[] }) =>
  isRefsReady.value && ids.some((id) => !refVisual({ type, id }));

const translate = (error: AutomationValidationError | null) =>
  error && (error.params ? t(error.key, error.params) : t(error.key));

const formError = computed(() => {
  if (!form.conditions.items.length) return t('automations.editor.errors.conditionsRequired');
  if (!form.actions.length) return t('automations.editor.errors.actionsRequired');
  return null;
});

const formNameError = computed(() => translate(nameError({ name: form.name })));

const conditionErrors = computed(() =>
  form.conditions.items.map((_, index) =>
    translate(conditionError({ items: form.conditions.items, index, hasMissingRef })),
  ),
);
const actionErrors = computed(() => form.actions.map((action) => translate(actionError({ action, hasMissingRef }))));

const matchTabs = computed(() => [
  { value: 'all', label: t('automations.editor.matchAll') },
  { value: 'any', label: t('automations.editor.matchAny') },
]);

const finalizeActions = ({ actions }: { actions: AutomationActionDraft[] }): AutomationAction[] =>
  actions.map((action): AutomationAction => {
    if (action.type === 'set_category') return { ...action, categoryId: action.categoryId! };
    if (action.type === 'set_payee') return { ...action, payeeId: action.payeeId! };
    return action;
  });

/** Live plain-words recap of the rule, built only from the parts that are already valid. */
const sentenceChips = computed(() =>
  buildAutomationChips({
    rule: {
      conditions: {
        match: form.conditions.match,
        items: form.conditions.items.filter(
          (_, index) => !conditionError({ items: form.conditions.items, index, hasMissingRef }),
        ),
      },
      actions: finalizeActions({
        actions: form.actions.filter((action) => !actionError({ action, hasMissingRef })),
      }),
    },
  }),
);
const hasSentence = computed(() => sentenceChips.value.when.length > 0 && sentenceChips.value.then.length > 0);
const previewOpen = ref(false);
const previewId = useId();

const areConditionsValid = computed(
  () => form.conditions.items.length > 0 && conditionErrors.value.every((error) => !error),
);

const isValid = computed(
  () =>
    !formNameError.value && !formError.value && areConditionsValid.value && actionErrors.value.every((error) => !error),
);

const showErrors = ref(false);

const createMutation = useCreateAutomation();
const updateMutation = useUpdateAutomation();
const isSaving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

const goToList = () => router.push({ name: ROUTES_NAMES.automations });

const handleSave = () => {
  showErrors.value = true;
  if (!isValid.value || isSaving.value || (!isCreate.value && !isDirty.value)) return;

  const payload = {
    name: form.name.trim(),
    isEnabled: form.isEnabled,
    conditions: normalizedConditions.value,
    actions: finalizeActions({ actions: form.actions }),
  };

  const handlers = {
    onSuccess: () => {
      snapshot.value = serializeDraft();
      addSuccessNotification(t('automations.editor.saveSuccess'));
      goToList();
    },
    onError: (error: unknown) =>
      addErrorNotification(extractApiErrorMessage(error) || t('automations.editor.errors.saveFailed')),
  };

  if (isCreate.value) createMutation.mutate({ payload }, handlers);
  else updateMutation.mutate({ id: ruleId.value!, payload }, handlers);
};

const isDirty = computed(() => isLoaded.value && serializeDraft() !== snapshot.value);
const pendingPath = ref<string | null>(null);
const isLeaveDialogOpen = ref(false);

onBeforeRouteLeave((to) => {
  if (!isDirty.value) return true;
  pendingPath.value = to.fullPath;
  isLeaveDialogOpen.value = true;
  return false;
});

const isApplyOpen = ref(false);

const confirmLeave = () => {
  const path = pendingPath.value;
  pendingPath.value = null;
  snapshot.value = serializeDraft();
  if (path) router.push(path);
};
</script>

<template>
  <div
    class="flex h-[calc(100dvh-var(--header-height)-var(--bottom-navbar-height,0px)-1rem)] min-h-0 w-full max-w-5xl flex-col overflow-hidden md:h-[calc(100dvh-var(--header-height))]"
    :style="visibleEditorHeight"
  >
    <div class="border-border @container/editor-head flex shrink-0 items-center gap-2 border-b px-3 py-2 md:px-6">
      <DesktopOnlyTooltip :content="$t('automations.editor.back')">
        <router-link :to="{ name: ROUTES_NAMES.automations }">
          <Button as="span" variant="ghost" size="icon-sm" :aria-label="$t('automations.editor.back')">
            <ArrowLeftIcon class="size-4" />
          </Button>
        </router-link>
      </DesktopOnlyTooltip>
      <h1 class="min-w-0 truncate text-2xl font-bold tracking-tight">
        {{ isCreate ? $t('automations.editor.titleNew') : $t('automations.editor.titleEdit') }}
      </h1>

      <div class="ml-auto flex shrink-0 items-center gap-1">
        <DesktopOnlyTooltip
          v-if="!isCreate && automation"
          :disabled="!isDirty"
          :content="$t('automations.applyToHistory.saveFirst')"
        >
          <span class="ml-auto inline-flex shrink-0">
            <Button
              variant="outline"
              size="sm"
              :disabled="isDirty"
              :aria-label="$t('automations.applyToHistory.trigger')"
              @click="isApplyOpen = true"
            >
              <HistoryIcon class="size-4" />
              <span class="hidden @md/editor-head:inline">{{ $t('automations.applyToHistory.trigger') }}</span>
            </Button>
          </span>
        </DesktopOnlyTooltip>
        <AutomationGuide compact-trigger />
      </div>
    </div>

    <Card v-if="!isCreate && !isFetched" class="flex flex-col gap-3 p-4">
      <div v-for="index in SKELETON_ROW_COUNT" :key="index" class="bg-muted h-14 animate-pulse rounded-md" />
    </Card>

    <Card v-else-if="!isCreate && isError && !automation" class="text-destructive-text px-6 py-12 text-center text-sm">
      {{ $t('automations.loadError') }}
    </Card>

    <ResourceNotFound
      v-else-if="!isCreate && !automation"
      :title="$t('automations.editor.notFound.title')"
      :description="$t('automations.editor.notFound.description')"
      :link-label="$t('automations.editor.notFound.link')"
      :link-to="{ name: ROUTES_NAMES.automations }"
    />

    <template v-else>
      <form
        :id="formId"
        data-no-nav-swipe
        class="lajur-dialog-scroll @container/editor min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 md:p-6"
        @submit.prevent="handleSave"
        @focusout="showErrors = true"
      >
        <p class="text-muted-foreground max-w-prose text-sm leading-relaxed">{{ $t('automations.guide.intro') }}</p>
        <Card :class="['flex flex-wrap items-end gap-x-5 gap-y-2 p-3', showErrors && formNameError && 'pb-7']">
          <InputField
            v-model="form.name"
            class="w-full min-w-0 @xl/editor:max-w-md @xl/editor:flex-1"
            :label="$t('automations.editor.nameLabel')"
            :placeholder="$t('automations.editor.namePlaceholder')"
            :error-message="showErrors ? (formNameError ?? undefined) : undefined"
            error-placement="absolute"
          />
          <label for="automation-enabled" class="flex h-10 shrink-0 items-center gap-2 text-sm md:h-9">
            <Switch id="automation-enabled" v-model="form.isEnabled" />
            {{ $t('automations.editor.enabled') }}
          </label>
        </Card>

        <div class="flex flex-col">
          <RailSection :icon="ListFilterIcon" tone="when" connected>
            <template #header>
              <div class="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {{ $t('automations.editor.steps.conditions') }}
                <HintIcon
                  :title="$t('automations.guide.conditionsTitle')"
                  :content="$t('automations.guide.conditionsHelp')"
                />
                <PillTabs
                  v-if="form.conditions.items.length > 1"
                  size="sm"
                  :items="matchTabs"
                  :model-value="form.conditions.match"
                  @update:model-value="(match) => (form.conditions.match = match as 'all' | 'any')"
                />
              </div>
            </template>
            <ConditionsBuilder v-model="form.conditions" :errors="showErrors ? conditionErrors : []" />
          </RailSection>

          <RailSection :icon="ListChecksIcon" tone="then">
            <template #header>
              <div class="flex items-center gap-1 text-sm font-semibold">
                {{ $t('automations.editor.steps.actions') }}
                <HintIcon
                  :title="$t('automations.guide.actionsTitle')"
                  :content="$t('automations.guide.actionsHelp')"
                />
              </div>
            </template>
            <ActionsBuilder v-model="form.actions" :errors="showErrors ? actionErrors : []" />
          </RailSection>
        </div>

        <LayoutCollapse :open="hasSentence">
          <div
            class="border-border bg-card flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border px-3 py-2.5"
          >
            <h2 class="w-full text-sm font-semibold">{{ $t('automations.guide.summaryTitle') }}</h2>
            <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {{ $t('automations.chips.when') }}
            </span>
            <AutomationChipTrack
              :chips="sentenceChips.when"
              variant="when"
              density="comfortable"
              :match="form.conditions.match"
            />
            <template v-if="sentenceChips.then.length">
              <ArrowRightIcon class="text-muted-foreground size-3.5 shrink-0" />
              <span class="text-primary-text text-xs font-semibold tracking-wider uppercase">
                {{ $t('automations.chips.then') }}
              </span>
              <AutomationChipTrack :chips="sentenceChips.then" variant="then" density="comfortable" />
            </template>
          </div>
        </LayoutCollapse>

        <Card class="p-2">
          <Button
            type="button"
            variant="ghost"
            class="min-h-11 w-full justify-between text-left whitespace-normal"
            :aria-expanded="previewOpen"
            :aria-controls="previewId"
            @click="previewOpen = !previewOpen"
          >
            {{ $t('automations.editor.steps.preview') }}
            <ChevronDownIcon
              class="size-4 shrink-0 motion-safe:transition-transform"
              :class="previewOpen && 'rotate-180'"
              aria-hidden="true"
            />
          </Button>
          <LayoutCollapse :id="previewId" :open="previewOpen">
            <div class="p-2">
              <PreviewPanel
                :conditions="normalizedConditions"
                :actions="form.actions"
                :action-chips="sentenceChips.then"
                :disabled="!areConditionsValid"
              />
            </div>
          </LayoutCollapse>
        </Card>

        <LayoutCollapse :open="Boolean(showErrors && formError)">
          <p class="text-destructive-text text-sm" role="alert">{{ formError }}</p>
        </LayoutCollapse>
      </form>
      <footer
        class="bg-background/95 border-border grid shrink-0 grid-cols-1 items-center gap-2 border-t px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] md:flex md:justify-end md:px-6"
      >
        <p v-if="!isValid" class="text-muted-foreground text-xs md:mr-auto">
          {{ $t('automations.guide.incomplete') }}
        </p>
        <Button
          type="submit"
          :form="formId"
          class="min-h-11 w-full md:w-auto"
          :disabled="!isValid || isSaving || (!isCreate && !isDirty)"
          :loading="isSaving"
        >
          {{ $t('common.actions.save') }}
        </Button>
      </footer>
    </template>

    <ApplyToHistoryDialog v-if="isApplyOpen" v-model:open="isApplyOpen" :rule="automation" />

    <ResponsiveAlertDialog
      v-model:open="isLeaveDialogOpen"
      :confirm-label="$t('automations.editor.unsaved.confirm')"
      confirm-variant="destructive"
      @confirm="confirmLeave"
    >
      <template #title>{{ $t('automations.editor.unsaved.title') }}</template>
      <template #description>{{ $t('automations.editor.unsaved.description') }}</template>
    </ResponsiveAlertDialog>
  </div>
</template>
