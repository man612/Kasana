import type { QueryInterface } from 'sequelize';

// Each Sequelize ENUM column is a separate PostgreSQL type.
// Adding values must run outside a surrounding transaction.
const TYPE_NAMES = [
  'enum_Transactions_paymentType',
  'enum_Accounts_defaultPaymentType',
  'enum_TransactionTemplates_paymentType',
] as const;
const VALUES = ['qris', 'eWallet', 'virtualAccount', 'emoneyCard', 'autoDebit', 'payLater'] as const;

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT typname FROM pg_type WHERE typname IN ('enum_Transactions_paymentType', 'enum_Accounts_defaultPaymentType', 'enum_TransactionTemplates_paymentType')",
    );
    const found = new Set((rows as { typname: string }[]).map((row) => row.typname));
    for (const typeName of TYPE_NAMES) {
      if (!found.has(typeName)) continue;
      for (const value of VALUES) {
        await queryInterface.sequelize.query('ALTER TYPE "' + typeName + '" ADD VALUE IF NOT EXISTS \'' + value + "';");
      }
    }
  },
  // PostgreSQL ENUM values cannot be removed safely without a destructive table rewrite.
  // Keep the values on rollback; old app versions may ignore values they do not recognize.
  down: async (): Promise<void> => {},
};
