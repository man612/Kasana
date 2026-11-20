import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn('TransactionGroups', 'icon', { type: DataTypes.STRING(100), allowNull: true });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('TransactionGroups', 'icon');
  },
};
