const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Driver = sequelize.define('Driver', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: DataTypes.STRING,
  password: { type: DataTypes.STRING, allowNull: false },
  vehicleType: { type: DataTypes.STRING, defaultValue: '' },
  vehicleNumber: { type: DataTypes.STRING, defaultValue: '' },
  licenseNumber: { type: DataTypes.STRING, defaultValue: '' },
  city: { type: DataTypes.STRING, defaultValue: '' },
  verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  role: { type: DataTypes.STRING, defaultValue: 'driver' },
  createdAt: DataTypes.STRING,
}, { tableName: 'drivers', timestamps: false });

module.exports = Driver;
