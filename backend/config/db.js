const sequelize = require('./database');
require('../models'); // registers every model with `sequelize` before sync()

async function connectDB() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    // Safe additive migration for databases created before live tracking was added.
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable('trip_status');
    const { DataTypes } = require('sequelize');
    const additions = {
      latitude: { type: DataTypes.FLOAT, allowNull: true },
      longitude: { type: DataTypes.FLOAT, allowNull: true },
      accuracy: { type: DataTypes.FLOAT, allowNull: true },
      locationUpdatedAt: { type: DataTypes.STRING, allowNull: true },
    };
    for (const [column, definition] of Object.entries(additions)) {
      if (!columns[column]) await queryInterface.addColumn('trip_status', column, definition);
    }
    console.log(`✅ Database connected (${sequelize.getDialect()})`);
  } catch (err) {
    console.error('❌ Could not connect to the database:', err.message);
    if (sequelize.getDialect() === 'mysql') {
      console.error('   Check DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD in backend/.env,');
      console.error('   and that MySQL is running and the database has been created.');
    } else {
      console.error('   Check DB_STORAGE in backend/.env points to a writable path.');
    }
    process.exit(1);
  }
}

module.exports = connectDB;
