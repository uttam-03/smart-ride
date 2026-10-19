const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Rating = sequelize.define('Rating', {
  id: { type: DataTypes.STRING, primaryKey: true },
  subscriptionId: DataTypes.STRING,
  userId: DataTypes.STRING,
  driverId: DataTypes.STRING,
  stars: DataTypes.INTEGER,
  comment: { type: DataTypes.TEXT, defaultValue: '' },
  createdAt: DataTypes.STRING,
  updatedAt: DataTypes.STRING,
}, { tableName: 'ratings', timestamps: false });

module.exports = Rating;
