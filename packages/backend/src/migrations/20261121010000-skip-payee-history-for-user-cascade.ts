import { QueryInterface } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Account removal cascades through payees and categories. Writing back to a
      // transaction during that cascade can recheck a category already being deleted.
      await queryInterface.sequelize.query(
        `
        DROP TRIGGER preserve_deleted_payee_name ON "Payees";
        CREATE TRIGGER preserve_deleted_payee_name BEFORE DELETE ON "Payees"
          FOR EACH ROW WHEN (pg_trigger_depth() = 0)
          EXECUTE FUNCTION preserve_deleted_payee_name();

        CREATE OR REPLACE VIEW real_transactions AS
          SELECT * FROM "Transactions" WHERE "isPlanned" = false AND "deletedAt" IS NULL;
        `,
        { transaction },
      );
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        DROP TRIGGER preserve_deleted_payee_name ON "Payees";
        CREATE TRIGGER preserve_deleted_payee_name BEFORE DELETE ON "Payees"
          FOR EACH ROW EXECUTE FUNCTION preserve_deleted_payee_name();
        `,
        { transaction },
      );
    });
  },
};
