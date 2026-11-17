import { QueryInterface, Transaction } from 'sequelize';

/**
 * Cap admission at the actual PostgreSQL ba_user write. The AFTER INSERT
 * STATEMENT trigger sees all rows from this INSERT and holds a singleton row
 * lock until commit; it therefore coordinates different backend processes.
 *
 * Hosted capacity counts the union of immutable trial ledger hashes and
 * currently persisted auth emails, including those awaiting the after-hook.
 */
module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `CREATE TABLE "SignupCapacity" (
          id SMALLINT PRIMARY KEY CHECK (id = 1),
          "maxSignups" BIGINT NULL CHECK ("maxSignups" >= 0),
          "scope" TEXT NOT NULL CHECK ("scope" IN ('self-host', 'hosted'))
        );
        INSERT INTO "SignupCapacity" (id, "maxSignups", "scope")
        VALUES (1, NULL, 'self-host');`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `CREATE FUNCTION lajur_signup_capacity_count(target_scope TEXT)
        RETURNS BIGINT LANGUAGE plpgsql VOLATILE AS $$
        DECLARE result_count BIGINT;
        BEGIN
          IF target_scope = 'self-host' THEN
            SELECT COUNT(*) INTO result_count FROM ba_user;
          ELSIF target_scope = 'hosted' THEN
            -- Historic normalized identities remain counted after deletion.
            -- Multiple live accounts with one normalized hash still consume
            -- multiple physical slots, preventing Gmail alias cap bypass.
            WITH live_hashes AS (
              SELECT encode(sha256(convert_to(
                CASE
                  WHEN split_part(lower(btrim(email)), '@', 2) IN ('gmail.com', 'googlemail.com')
                  THEN replace(regexp_replace(split_part(lower(btrim(email)), '@', 1), '\\+.*$', ''), '.', '') || '@gmail.com'
                  ELSE regexp_replace(split_part(lower(btrim(email)), '@', 1), '\\+.*$', '') || '@' || split_part(lower(btrim(email)), '@', 2)
                END, 'UTF8')), 'hex') AS email_hash
              FROM ba_user WHERE email IS NOT NULL
            ), identities AS (
              SELECT "emailHash" AS email_hash FROM "SignupLedger"
              UNION
              SELECT email_hash FROM live_hashes
            )
            SELECT (SELECT COUNT(*) FROM identities)
              + (SELECT COUNT(*) - COUNT(DISTINCT email_hash) FROM live_hashes)
            INTO result_count;
          ELSE
            RAISE EXCEPTION 'Invalid signup capacity scope' USING ERRCODE = '23514';
          END IF;
          RETURN result_count;
        END;
        $$;`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `CREATE FUNCTION lajur_enforce_signup_capacity()
        RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
        DECLARE cap BIGINT;
        DECLARE admission_scope TEXT;
        DECLARE counted BIGINT;
        BEGIN
          -- Empty INSERT ... SELECT / ON CONFLICT DO NOTHING must not turn
          -- an existing login/upsert into a quota failure.
          IF NOT EXISTS (SELECT 1 FROM lajur_inserted_users) THEN
            RETURN NULL;
          END IF;

          -- The fresh post-lock count is proven for READ COMMITTED; do not
          -- silently weaken admission on a pre-existing repeatable snapshot.
          IF current_setting('transaction_isolation') <> 'read committed' THEN
            RAISE EXCEPTION 'SIGNUP_CAPACITY_REQUIRES_READ_COMMITTED' USING ERRCODE = '23514';
          END IF;

          -- All competing INSERT transactions serialize on this one row.
          SELECT "maxSignups", "scope" INTO cap, admission_scope
          FROM "SignupCapacity" WHERE id = 1 FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'SIGNUP_CAPACITY_POLICY_MISSING' USING ERRCODE = '23514';
          END IF;
          IF cap IS NULL THEN RETURN NULL; END IF;

          -- A VOLATILE query after waiting for the row lock reads completed
          -- prior insert transactions under PostgreSQL READ COMMITTED.
          SELECT lajur_signup_capacity_count(admission_scope) INTO counted;
          IF counted > cap THEN
            RAISE EXCEPTION 'SIGNUP_CAPACITY_EXCEEDED' USING ERRCODE = '23514';
          END IF;
          RETURN NULL;
        END;
        $$;
        CREATE TRIGGER lajur_auth_signup_capacity_guard
        AFTER INSERT ON ba_user
        REFERENCING NEW TABLE AS lajur_inserted_users
        FOR EACH STATEMENT EXECUTE FUNCTION lajur_enforce_signup_capacity();`,
        { transaction: t },
      );
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS lajur_auth_signup_capacity_guard ON ba_user',
        { transaction: t },
      );
      await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS lajur_enforce_signup_capacity()', {
        transaction: t,
      });
      await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS lajur_signup_capacity_count(TEXT)', {
        transaction: t,
      });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS "SignupCapacity"', { transaction: t });
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
};
