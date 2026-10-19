const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TripStatus = sequelize.define('TripStatus', {
  id: { type: DataTypes.STRING, primaryKey: true },
  subscriptionId: DataTypes.STRING,
  date: DataTypes.STRING,
  status: DataTypes.STRING,
  updatedAt: DataTypes.STRING,
  latitude: { type: DataTypes.FLOAT, defaultValue: null },
  longitude: { type: DataTypes.FLOAT, defaultValue: null },
  accuracy: { type: DataTypes.FLOAT, defaultValue: null },
  locationUpdatedAt: { type: DataTypes.STRING, defaultValue: null },
}, { tableName: 'trip_status', timestamps: false });

module.exports = TripStatus;
