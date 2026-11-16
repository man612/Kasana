import { safeRequestLogUrl } from './safe-request-log-url';

describe('safeRequestLogUrl', () => {
  it.each([
    ['/reset-password?token=once-only&callbackURL=/dashboard', '/reset-password'],
    ['/api/v1/auth/verify-email?token=private-token', '/api/v1/auth/verify-email'],
    ['/api/v1/auth/callback/google?code=oauth-code&state=private-state', '/api/v1/auth/callback/google'],
    ['/api/v1/auth/reset-password/legacy-secret?next=/dashboard', '/api/v1/auth/reset-password/[redacted]'],
    ['/accounts?search=private-merchant&currency=IDR', '/accounts'],
    ['/dashboard', '/dashboard'],
  ])('sanitizes %s without exposing secrets', (originalUrl, expected) => {
    expect(safeRequestLogUrl({ originalUrl })).toBe(expected);
  });
});
