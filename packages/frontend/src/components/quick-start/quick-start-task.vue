<script lang="ts" setup>
import { cn } from '@/lib/utils';
import type { OnboardingTask } from '@/stores/onboarding';
import { CheckIcon, CircleIcon } from '@lucide/vue';

const props = defineProps<{
  task: OnboardingTask;
  isCompleted: boolean;
}>();

const emit = defineEmits<{
  click: [task: OnboardingTask];
}>();

const handleClick = () => {
  if (!props.isCompleted) {
    emit('click', props.task);
  }
};
</script>

<template>
  <button
    type="button"
    :class="
      cn(
        'flex w-full items-center gap-2 rounded py-1.5 pl-2 text-left transition-colors',
        isCompleted ? 'cursor-default' : 'hover:bg-muted/50 cursor-pointer',
      )
    "
    :disabled="isCompleted"
    @click="handleClick"
  >
    <!-- Checkbox circle -->
    <span class="grid size-5 shrink-0 place-items-center">
      <Transition name="kasana-icon" mode="out-in">
        <span
          v-if="isCompleted"
          key="completed"
          class="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full"
        >
          <CheckIcon class="size-3" />
        </span>
        <CircleIcon v-else key="pending" class="text-muted-foreground/50 size-5" />
      </Transition>
    </span>

    <!-- Title and description -->
    <div class="min-w-0 flex-1">
      <span :class="cn('text-sm', isCompleted && 'text-muted-foreground line-through')">
        {{ task.title }}
      </span>
      <p v-if="task.description" class="text-muted-foreground text-xs">
        {{ task.description }}
      </p>
    </div>
  </button>
</template>
