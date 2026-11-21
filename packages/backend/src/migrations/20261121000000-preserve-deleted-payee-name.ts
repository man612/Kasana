import { DataTypes, QueryInterface } from 'sequelize';

import { dropRealTransactionsViewSql } from './utils/real-transactions-view';

const createRealTransactionsViewSql = `CREATE OR REPLACE VIEW real_transactions AS SELECT * FROM "Transactions" WHERE "isPlanned" = false AND "deletedAt" IS NULL;`;

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'Transactions',
        'payeeNameSnapshot',
        { type: DataTypes.STRING(200), allowNull: true },
        { transaction },
      );
      // Snapshot all linked rows, including trash, before the existing FK clears the link.
      // Keeping this on the FK's delete path covers single, bulk and ignore-name operations.
      await queryInterface.sequelize.query(
        `
        CREATE FUNCTION preserve_deleted_payee_name() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          UPDATE "Transactions"
          SET "payeeNameSnapshot" = OLD."name"
          WHERE "payeeId" = OLD."id";
          RETURN OLD;
        END;
        $$;

        CREATE TRIGGER preserve_deleted_payee_name BEFORE DELETE ON "Payees"
          FOR EACH ROW EXECUTE FUNCTION preserve_deleted_payee_name();

        CREATE FUNCTION clear_replaced_payee_name() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          NEW."payeeNameSnapshot" := NULL;
          RETURN NEW;
        END;
        $$;

        CREATE TRIGGER clear_replaced_payee_name BEFORE UPDATE OF "payeeId" ON "Transactions"
          FOR EACH ROW
          WHEN (OLD."payeeNameSnapshot" IS NOT NULL AND NEW."payeeId" IS NOT NULL)
          EXECUTE FUNCTION clear_replaced_payee_name();
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(createRealTransactionsViewSql, { transaction });
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        DROP TRIGGER clear_replaced_payee_name ON "Transactions";
        DROP FUNCTION clear_replaced_payee_name();
        DROP TRIGGER preserve_deleted_payee_name ON "Payees";
        DROP FUNCTION preserve_deleted_payee_name();
        `,
        { transaction },
      );
      await queryInterface.sequelize.query(dropRealTransactionsViewSql, { transaction });
      await queryInterface.removeColumn('Transactions', 'payeeNameSnapshot', { transaction });
      await queryInterface.sequelize.query(createRealTransactionsViewSql, { transaction });
    });
  },
};
