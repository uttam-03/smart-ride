const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.STRING, primaryKey: true },
  subscriptionId: DataTypes.STRING,
  senderId: DataTypes.STRING,
  senderRole: DataTypes.STRING,
  text: DataTypes.TEXT,
  createdAt: DataTypes.STRING,
}, { tableName: 'messages', timestamps: false });

module.exports = Message;
