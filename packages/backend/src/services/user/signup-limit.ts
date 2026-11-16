/**
 * Missing/empty is deliberately unlimited for backward-compatible self-hosts.
 * A configured cap must be a non-negative, decimal, safe integer: invalid
 * configuration must never silently open unlimited public signups.
 */
export type SignupLimit =
  | { kind: 'unlimited' }
  | { kind: 'capped'; max: number }
  | { kind: 'invalid' };

export function parseSignupLimit(raw: string | undefined): SignupLimit {
  if (raw === undefined || raw === '') return { kind: 'unlimited' };
  const value = raw.trim();
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return { kind: 'invalid' };
  const max = Number(value);
  if (!Number.isSafeInteger(max)) return { kind: 'invalid' };
  return { kind: 'capped', max };
}
