import { describe, expect, it } from '@jest/globals';
import { connection } from '@models/index';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/** Two real pg pools simulate distinct backend workers sharing one migrated DB. */
function separatePool(): Pool {
  return new Pool({
    host: process.env.APPLICATION_DB_HOST,
    port: Number(process.env.APPLICATION_DB_PORT),
    user: process.env.APPLICATION_DB_USERNAME,
    password: process.env.APPLICATION_DB_PASSWORD,
    database: process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID
      ? process.env.APPLICATION_DB_DATABASE + '-' + process.env.JEST_WORKER_ID
      : process.env.APPLICATION_DB_DATABASE,
    max: 12,
  });
}

async function setCapacity(scope: 'self-host' | 'hosted', max: number): Promise<void> {
  await connection.sequelize.query(
    'UPDATE "SignupCapacity" SET "scope" = :scope, "maxSignups" = :max WHERE id = 1',
    { replacements: { scope, max } },
  );
}

async function countCapacity(scope: 'self-host' | 'hosted'): Promise<number> {
  const [[row]] = (await connection.sequelize.query(
    'SELECT lajur_signup_capacity_count(:scope) AS count',
    { replacements: { scope } },
  )) as [[{ count: number | string }], unknown];
  return Number(row.count);
}

async function createAuthUser(pool: Pool, suffix: string, email?: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO ba_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
     VALUES ($1, 'Capacity Test', $2, false, NULL, NOW(), NOW())`,
    [id, email ?? ('capacity-' + suffix + '@test.local')],
  );
  return id;
}

async function admitted(pool: Pool, suffix: string): Promise<boolean> {
  try {
    await createAuthUser(pool, suffix);
    return true;
  } catch (error) {
    // Do not silently interpret network/migration/DB errors as quota rejections.
    if ((error as { code?: string }).code !== '23514') throw error;
    return false;
  }
}

describe('Atomic PostgreSQL signup admission on real migrated database', () => {
  it('allows exactly five of forty concurrent self-host inserts through two pools', async () => {
    const baseline = await countCapacity('self-host');
    await setCapacity('self-host', baseline + 5);
    const first = separatePool();
    const second = separatePool();
    try {
      const results = await Promise.all(
        Array.from({ length: 40 }, (_, i) =>
          admitted(i % 2 === 0 ? first : second, 'self-' + i + '-' + randomUUID())),
      );
      expect(results.filter(Boolean)).toHaveLength(5);
      expect(results.filter((allowed) => !allowed)).toHaveLength(35);
      expect(await countCapacity('self-host')).toBe(baseline + 5);
    } finally {
      await Promise.all([first.end(), second.end()]);
    }
  }, 30_000);

  it('counts hosted auth users before post-commit ledger insertion, across two pools', async () => {
    const baseline = await countCapacity('hosted');
    await setCapacity('hosted', baseline + 3);
    const first = separatePool();
    const second = separatePool();
    try {
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          admitted(i % 2 === 0 ? first : second, 'cloud-' + i + '-' + randomUUID())),
      );
      expect(results.filter(Boolean)).toHaveLength(3);
      expect(results.filter((allowed) => !allowed)).toHaveLength(21);
      expect(await countCapacity('hosted')).toBe(baseline + 3);
    } finally {
      await Promise.all([first.end(), second.end()]);
    }
  }, 30_000);

  it('blocks at zero and releases a slot on transaction rollback', async () => {
    const baseline = await countCapacity('self-host');
    const pool = separatePool();
    try {
      await setCapacity('self-host', 0);
      expect(await admitted(pool, 'closed-' + randomUUID())).toBe(false);
      expect(await countCapacity('self-host')).toBe(baseline);

      await setCapacity('self-host', baseline + 1);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO ba_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
           VALUES ($1, 'Rollback', $2, false, NULL, NOW(), NOW())`,
          [randomUUID(), 'rollback-' + randomUUID() + '@test.local'],
        );
        await client.query('ROLLBACK');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      expect(await countCapacity('self-host')).toBe(baseline);
      expect(await admitted(pool, 'retry-' + randomUUID())).toBe(true);
      expect(await admitted(pool, 'over-' + randomUUID())).toBe(false);
    } finally {
      await pool.end();
    }
  });

  it('self-host deletion returns capacity, but hosted ledger history remains counted', async () => {
    const pool = separatePool();
    try {
      const baseline = await countCapacity('self-host');
      await setCapacity('self-host', baseline + 1);
      const createdId = await createAuthUser(pool, 'delete-' + randomUUID());
      expect(await admitted(pool, 'over-' + randomUUID())).toBe(false);
      await pool.query('DELETE FROM ba_user WHERE id = $1', [createdId]);
      expect(await admitted(pool, 'reclaimed-' + randomUUID())).toBe(true);

      // Hosted counting deliberately includes a historical email hash even
      // after its matching auth account has been deleted.
      const hostedBaseline = await countCapacity('hosted');
      await connection.sequelize.query(
        `INSERT INTO "SignupLedger" ("emailHash", "firstSeenAt")
         VALUES (:emailHash, NOW())`,
        { replacements: { emailHash: 'f'.repeat(63) + '0' } },
      );
      expect(await countCapacity('hosted')).toBe(hostedBaseline + 1);
    } finally {
      await pool.end();
    }
  });

  it('does not let Gmail dot/plus aliases bypass the hosted physical account cap', async () => {
    const baseline = await countCapacity('hosted');
    await setCapacity('hosted', baseline + 1);
    const pool = separatePool();
    try {
      const local = 'lajur' + randomUUID().replace(/-/g, '').slice(0, 16);
      await createAuthUser(pool, 'canonical', local + '@gmail.com');
      expect(await countCapacity('hosted')).toBe(baseline + 1);

      const alias = local.slice(0, 5) + '.' + local.slice(5) + '+another@googlemail.com';
      let rejectedAsQuota = false;
      try {
        await createAuthUser(pool, 'alias', alias);
      } catch (error) {
        if ((error as { code?: string }).code !== '23514') throw error;
        rejectedAsQuota = true;
      }
      expect(rejectedAsQuota).toBe(true);
      expect(await countCapacity('hosted')).toBe(baseline + 1);
    } finally {
      await pool.end();
    }
  });

  it('allows a zero-row INSERT without charging capacity at cap zero', async () => {
    await setCapacity('self-host', 0);
    const pool = separatePool();
    try {
      await expect(pool.query(
        `INSERT INTO ba_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
         SELECT 'no-record', 'Nothing', 'nothing@test.local', false, NULL, NOW(), NOW()
         WHERE FALSE`,
      )).resolves.toBeDefined();
    } finally {
      await pool.end();
    }
  });

  it('fails closed if user creation uses a non-READ COMMITTED transaction', async () => {
    const baseline = await countCapacity('self-host');
    await setCapacity('self-host', baseline + 1);
    const pool = separatePool();
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        await expect(client.query(
          `INSERT INTO ba_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
           VALUES ($1, 'Unsafe Isolation', $2, false, NULL, NOW(), NOW())`,
          [randomUUID(), 'isolation-' + randomUUID() + '@test.local'],
        )).rejects.toMatchObject({ code: '23514' });
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      expect(await countCapacity('self-host')).toBe(baseline);
    } finally {
      await pool.end();
    }
  });

  it('preserves unlimited self-host inserts under REPEATABLE READ', async () => {
    const pool = separatePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await expect(client.query(
        `INSERT INTO ba_user (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
         VALUES ($1, 'Unlimited', $2, false, NULL, NOW(), NOW())`,
        [randomUUID(), 'unlimited-' + randomUUID() + '@test.local'],
      )).resolves.toBeDefined();
      await client.query('ROLLBACK');
    } finally {
      client.release();
      await pool.end();
    }
  });
});
