const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: { type: DataTypes.STRING, primaryKey: true },
  userId: DataTypes.STRING,
  planId: DataTypes.STRING,
  pickup: DataTypes.STRING,
  drop: DataTypes.STRING,
  pickupLat: { type: DataTypes.FLOAT, defaultValue: null },
  pickupLng: { type: DataTypes.FLOAT, defaultValue: null },
  dropLat: { type: DataTypes.FLOAT, defaultValue: null },
  dropLng: { type: DataTypes.FLOAT, defaultValue: null },
  preferredTime: DataTypes.STRING,
  city: { type: DataTypes.STRING, defaultValue: '' },
  driverId: { type: DataTypes.STRING, defaultValue: null },
  status: { type: DataTypes.STRING, defaultValue: 'pending_payment' },
  startDate: { type: DataTypes.STRING, defaultValue: null },
  endDate: { type: DataTypes.STRING, defaultValue: null },
  renewalReminderSent: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: DataTypes.STRING,
}, { tableName: 'subscriptions', timestamps: false });

module.exports = Subscription;
