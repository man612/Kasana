import { QueryInterface } from 'sequelize';

const INDEX_NAME = 'transaction_group_items_transaction_lookup_idx';

module.exports = {
  // The UUID migration rebuilt the group-first primary key. The reverse lookup
  // needs its own index for transaction-list joins and membership validation.
  // Build it concurrently so existing installations can continue writing.
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addIndex('TransactionGroupItems', ['transactionId'], {
      name: INDEX_NAME,
      concurrently: true,
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex('TransactionGroupItems', INDEX_NAME, { concurrently: true });
  },
};
