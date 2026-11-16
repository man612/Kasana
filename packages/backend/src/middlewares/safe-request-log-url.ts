/**
 * Access logs must never store URL query parameters: password-reset, email-verification
 * and OAuth callbacks may carry single-use credentials before the browser strips them.
 * Also retain the existing redaction for legacy reset-password tokens in path segments.
 */
export const safeRequestLogUrl = ({ originalUrl }: { originalUrl: string }): string => {
  const pathname = originalUrl.split('?', 1)[0] ?? '';
  return pathname.replace(/(\/reset-password\/)[^/]+/gi, '$1[redacted]');
};
