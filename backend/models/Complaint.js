const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Complaint = sequelize.define('Complaint', {
  id: { type: DataTypes.STRING, primaryKey: true },
  raisedBy: DataTypes.STRING,
  raisedByRole: DataTypes.STRING,
  subject: DataTypes.STRING,
  message: DataTypes.TEXT,
  status: { type: DataTypes.STRING, defaultValue: 'open' },
  createdAt: DataTypes.STRING,
  resolvedAt: { type: DataTypes.STRING, defaultValue: null },
}, { tableName: 'complaints', timestamps: false });

module.exports = Complaint;
