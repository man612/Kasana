import type { BetterAuthOptions } from 'better-auth';

jest.mock('better-auth', () => ({ betterAuth: jest.fn((options) => ({ options })) }));
jest.mock('@better-auth/passkey', () => ({ passkey: jest.fn(() => ({ id: 'passkey' })) }));
jest.mock('@better-auth/expo', () => ({ expo: jest.fn(() => ({ id: 'expo' })) }));
jest.mock('@better-auth/oauth-provider', () => ({ oauthProvider: jest.fn(() => ({ id: 'oauth-provider' })) }));
jest.mock('better-auth/plugins', () => ({ genericOAuth: jest.fn(), jwt: jest.fn(() => ({ id: 'jwt' })) }));
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ on: jest.fn(), query: jest.fn() })) }));
jest.mock('@config/apple-client-secret', () => ({ getAppleClientSecretFromEnv: () => null }));
jest.mock('@config/oidc', () => ({ oidcConfig: null }));
jest.mock('@config/auth-hooks/session-hooks', () => ({ createSessionHooks: () => ({}) }));
jest.mock('@controllers/helpers/error-handler', () => ({ isAuthApiError: jest.fn() }));
jest.mock('@i18n/index', () => ({ t: jest.fn() }));
jest.mock('@js/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@js/utils/posthog', () => ({ identifyUser: jest.fn(), trackSignup: jest.fn() }));
jest.mock('@js/utils/sentry', () => ({ captureException: jest.fn() }));
jest.mock('@services/user/create-user-with-defaults.service', () => ({
  createAppUserWithUniqueUsername: jest.fn(),
  seedUserDefaults: jest.fn(),
}));
jest.mock('@services/user/signups-open.service', () => ({ areSignupsOpen: jest.fn() }));
jest.mock('@services/email/send-email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ data: { id: 'synthetic' } }),
}));

describe('authentication public display branding', () => {
  const originalEnv = process.env;
  const user = {
    id: 'synthetic-user',
    name: 'Synthetic',
    email: 'person@example.test',
    emailVerified: false,
    createdAt: new Date('2026-11-16'),
    updatedAt: new Date('2026-11-16'),
  };
  const url = 'https://finance.example.test/auth/action?token=synthetic-token';

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      AUTH_RP_ID: 'finance.example.test',
      AUTH_ORIGIN: 'https://finance.example.test',
      RESEND_API_KEY: 're_synthetic_unit_test',
      RESEND_FROM_EMAIL: 'noreply@example.test',
    };
    delete process.env.AUTH_RP_NAME;
    delete process.env.BETTER_AUTH_COOKIE_PREFIX;
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    [undefined, 'Lajur.'],
    ['', 'Lajur.'],
    ['Family Ledger', 'Family Ledger'],
    ['Ayu & Family', 'Ayu & Family'],
  ])('uses %s consistently in verification, reset and passkeys', async (configuredName, expectedName) => {
    if (configuredName !== undefined) process.env.AUTH_RP_NAME = configuredName;
    const { auth } = await import('./auth');
    const options = auth.options as BetterAuthOptions;
    const { sendEmail } = await import('@services/email/send-email');
    const { passkey } = await import('@better-auth/passkey');
    const { escapeHtml } = await import('@services/email');

    expect(jest.mocked(passkey).mock.calls[0]?.[0]).toMatchObject({
      rpName: expectedName,
      rpID: 'finance.example.test',
      origin: 'https://finance.example.test',
      schema: { passkey: { modelName: 'ba_passkey' } },
    });
    await options.emailVerification!.sendVerificationEmail!({ user, url, token: 'synthetic-token' });
    expect(sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: `${expectedName} <noreply@example.test>`,
        to: user.email,
        subject: `Verify your ${expectedName} email`,
        html: expect.stringContaining(`Welcome to ${escapeHtml(expectedName)}!`),
      }),
    );
    expect(jest.mocked(sendEmail).mock.calls[0]?.[0].html).toContain(`href="${url}"`);

    await options.emailAndPassword!.sendResetPassword!({ user, url, token: 'synthetic-token' });
    expect(sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: `${expectedName} <noreply@example.test>`,
        to: user.email,
        subject: `Reset your ${expectedName} password`,
        html: expect.stringContaining(`your ${escapeHtml(expectedName)} account`),
      }),
    );
    expect(jest.mocked(sendEmail).mock.calls[1]?.[0].html).toContain(`href="${url}"`);
    expect(options.advanced?.cookiePrefix).toBe('bt_auth');
    expect(options.user?.modelName).toBe('ba_user');
    expect(options.session?.modelName).toBe('ba_session');
    expect(options.account?.modelName).toBe('ba_account');
    expect(options.verification?.modelName).toBe('ba_verification');
    expect(options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
  });
});
