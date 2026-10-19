const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Plan = sequelize.define('Plan', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: DataTypes.STRING,
  durationDays: DataTypes.INTEGER,
  price: DataTypes.FLOAT,
  description: DataTypes.TEXT,
}, { tableName: 'plans', timestamps: false });

module.exports = Plan;
