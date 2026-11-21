import { DataTypes, QueryInterface } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'Vehicles',
        'vehicleType',
        { type: DataTypes.STRING(32), allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'Vehicles',
        'licensePlate',
        { type: DataTypes.STRING(32), allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'Vehicles',
        'valuationRevisions',
        { type: DataTypes.JSONB, allowNull: true },
        { transaction },
      );
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of ['valuationRevisions', 'licensePlate', 'vehicleType']) {
        await queryInterface.removeColumn('Vehicles', column, { transaction });
      }
    });
  },
};
