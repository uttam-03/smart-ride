const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: DataTypes.STRING,
  password: { type: DataTypes.STRING, allowNull: false },
  pickup: { type: DataTypes.STRING, defaultValue: '' },
  drop: { type: DataTypes.STRING, defaultValue: '' },
  city: { type: DataTypes.STRING, defaultValue: '' },
  role: { type: DataTypes.STRING, defaultValue: 'user' },
  createdAt: DataTypes.STRING,
}, { tableName: 'users', timestamps: false });

module.exports = User;
