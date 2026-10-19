const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.STRING, primaryKey: true },
  userId: DataTypes.STRING,
  message: DataTypes.TEXT,
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: DataTypes.STRING,
}, { tableName: 'notifications', timestamps: false });

module.exports = Notification;
