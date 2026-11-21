import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn('TransactionGroups', 'iconColor', { type: DataTypes.STRING(7), allowNull: true });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn('TransactionGroups', 'iconColor');
  },
};
