const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settings = sequelize.define('Settings', {
  upiId: { type: DataTypes.STRING, defaultValue: '' },
  payeeName: { type: DataTypes.STRING, defaultValue: 'Smart Ride' },
}, { tableName: 'settings', timestamps: false });

module.exports = Settings;
