import { isSelfHost } from '@config/is-self-host';
import { logger } from '@js/utils/logger';
import { connection } from '@models/index';
import SignupLedger from '@models/signup-ledger.model';
import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';

import { parseSignupLimit } from './signup-limit';

/** Lowercase, drop `+alias`, and for gmail drop dots – all of those deliver to one inbox. */
const normalizeEmail = ({ email }: { email: string }): string => {
  const [rawLocal = '', rawDomain = ''] = email.trim().toLowerCase().split('@');
  let local = rawLocal.replace(/\+.*$/, '');
  let domain = rawDomain;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
};

export const hashEmail = ({ email }: { email: string }): string =>
  createHash('sha256').update(normalizeEmail({ email })).digest('hex');

/**
 * Idempotent. `firstSeenAt` is when this email was first seen, which the trial window is
 * measured from — the ledger outlives account deletion, so re-signing up cannot restart a
 * trial. `created` tells the caller whether this call inserted the row, so a failed signup
 * can free the slot again.
 */
export const recordSignup = async ({ email }: { email: string }): Promise<{ firstSeenAt: Date; created: boolean }> => {
  const [row, created] = await SignupLedger.findOrCreate({
    where: { emailHash: hashEmail({ email }) },
  });
  return { firstSeenAt: row.firstSeenAt, created };
};

export const forgetSignup = async ({ email }: { email: string }): Promise<void> => {
  await SignupLedger.destroy({ where: { emailHash: hashEmail({ email }) } });
};

/**
 * SYSTEM_MAX_SIGNUPS_ALLOWED: on cloud it caps signups ever seen (the ledger), so
 * deleting a user does not free a trial slot. Self-host counts live users, so a
 * "just me" instance can delete and re-create its account. Missing/empty
 * remains unlimited for backward compatibility; malformed configured values
 * fail closed. 0 blocks all new signups. Read per call for test/operator changes.
 */
export async function areSignupsOpen(): Promise<boolean> {
  const limit = parseSignupLimit(process.env.SYSTEM_MAX_SIGNUPS_ALLOWED);
  if (limit.kind === 'invalid') {
    logger.error('SYSTEM_MAX_SIGNUPS_ALLOWED must be a non-negative safe integer; new signups are blocked.');
    return false;
  }
  // The AFTER INSERT trigger is the authoritative concurrency-safe guard.
  // A stored cap never increases automatically: a stale worker may not open
  // registration beyond the operator-approved database policy.
  const scope = isSelfHost() ? 'self-host' : 'hosted';
  const requested = limit.kind === 'capped' ? limit.max : null;

  try {
    const [stored] = (await connection.sequelize.query(
      `UPDATE "SignupCapacity"
       SET "maxSignups" =
         CASE WHEN CAST(:max AS BIGINT) IS NULL THEN "maxSignups"
              WHEN "maxSignups" IS NULL THEN CAST(:max AS BIGINT)
              ELSE LEAST("maxSignups", CAST(:max AS BIGINT)) END,
           "scope" = CASE WHEN "maxSignups" IS NULL THEN :scope ELSE "scope" END
       WHERE id = 1 RETURNING "maxSignups", "scope"`,
      { type: QueryTypes.SELECT, replacements: { max: requested, scope } },
    )) as Array<{ maxSignups: number | string | null; scope: string }>;

    if (!stored || stored.scope !== scope) {
      logger.error('Signup capacity mode mismatch or missing database policy; signups blocked.');
      return false;
    }
    const enforced = stored.maxSignups === null ? null : Number(stored.maxSignups);
    if ((requested === null && enforced !== null) ||
        (requested !== null && requested !== enforced)) {
      logger.error('Signup capacity differs from PostgreSQL policy; operator review required.');
      return false;
    }
    if (enforced === null) return true;
    if (enforced === 0) return false;

    const [row] = (await connection.sequelize.query(
      'SELECT lajur_signup_capacity_count(:scope) AS count',
      { type: QueryTypes.SELECT, replacements: { scope } },
    )) as Array<{ count: number | string }>;
    return Boolean(row && Number(row.count) < enforced);
  } catch (error) {
    logger.error({ message: 'Signup capacity database guard unavailable; signups blocked.', error: error as Error });
    return false;
  }
}
