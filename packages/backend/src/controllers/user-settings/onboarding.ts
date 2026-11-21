import { createController } from '@controllers/helpers/controller-factory';
import { ZodOnboardingStateUpdateSchema } from '@models/user-settings.model';
import * as onboardingService from '@services/user-settings/onboarding';
import { z } from 'zod';

/**
 * GET /user/settings/onboarding
 * Returns the user's onboarding state merged with auto-detected completed tasks
 */
export const getOnboarding = createController(
  z.object({
    query: z.object({ skipProgressWhenDismissed: z.enum(['true', 'false']).optional() }),
  }),
  async ({ user, query }) => {
    const { id: userId } = user;
    const stored = onboardingService.getOnboardingState({ userId });
    const detectProgress = () => onboardingService.detectCompletedTasks({ userId });
    // The app only needs visibility while the guide is dismissed. Keep the full
    // progress response for existing clients and for an enabled guide.
    const detected =
      query.skipProgressWhenDismissed === 'true'
        ? stored.then((state) => (state.isDismissed ? [] : detectProgress()))
        : detectProgress();
    const [storedState, detectedTasks] = await Promise.all([stored, detected]);

    return {
      data: {
        ...storedState,
        completedTasks: [...new Set([...storedState.completedTasks, ...detectedTasks])],
      },
    };
  },
);

/**
 * PUT /user/settings/onboarding
 * Updates the user's onboarding state
 */
export const updateOnboarding = createController(
  z.object({
    body: ZodOnboardingStateUpdateSchema,
  }),
  async ({ user, body }) => {
    const { id: userId } = user;
    const data = await onboardingService.updateOnboardingState({
      userId,
      onboardingState: body,
    });

    return { data };
  },
);
