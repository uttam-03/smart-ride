const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.STRING, primaryKey: true },
  driverId: DataTypes.STRING,
  subscriptionId: DataTypes.STRING,
  date: DataTypes.STRING,
  status: DataTypes.STRING,
  note: { type: DataTypes.STRING, defaultValue: '' },
  createdAt: DataTypes.STRING,
}, { tableName: 'attendance', timestamps: false });

module.exports = Attendance;
