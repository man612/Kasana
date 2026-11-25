import { afterEach, describe, expect, it, vi } from 'vitest';

import { identifyUser, initPostHog, resetUser, trackAnalyticsEvent } from './posthog';

const { config, calls, loadSdk, isOptedOut } = vi.hoisted(() => ({
  config: { posthogKey: '', posthogHost: '' },
  calls: [] as string[],
  loadSdk: vi.fn(),
  isOptedOut: vi.fn(() => false),
}));

vi.mock('@/common/config', () => ({ config }));
vi.mock('posthog-js', () => {
  loadSdk();
  return {
    default: {
      init: () => calls.push('init'),
      identify: () => calls.push('identify'),
      capture: (event: string) => calls.push(event),
      reset: () => calls.push('reset'),
      has_opted_out_capturing: isOptedOut,
    },
  };
});

afterEach(() => vi.unstubAllEnvs());

describe('optional PostHog SDK', () => {
  it('skips the SDK without a key and preserves event order while it loads', async () => {
    vi.stubEnv('PROD', true);
    expect(initPostHog()).toBeUndefined();
    trackAnalyticsEvent({ event: 'dashboard_edit_opened' });
    expect(loadSdk).not.toHaveBeenCalled();

    config.posthogKey = 'synthetic-key';
    identifyUser({ userId: 1 });
    trackAnalyticsEvent({ event: 'dashboard_edit_opened' });
    resetUser();
    await initPostHog();

    expect(loadSdk).toHaveBeenCalledOnce();
    expect(calls).toEqual(['init', 'identify', 'dashboard_edit_opened', 'reset']);

    isOptedOut.mockReturnValue(true);
    trackAnalyticsEvent({ event: 'transaction_creation_opened' });
    await initPostHog();
    expect(calls).not.toContain('transaction_creation_opened');
  });
});
