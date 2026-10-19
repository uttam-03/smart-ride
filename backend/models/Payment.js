const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.STRING, primaryKey: true },
  subscriptionId: DataTypes.STRING,
  userId: DataTypes.STRING,
  amount: DataTypes.FLOAT,
  method: DataTypes.STRING,
  utrNumber: DataTypes.STRING,
  payerUpiId: DataTypes.STRING,
  payerName: DataTypes.STRING,
  note: { type: DataTypes.STRING, defaultValue: '' },
  status: { type: DataTypes.STRING, defaultValue: 'pending_verification' },
  invoiceNumber: { type: DataTypes.STRING, defaultValue: null },
  rejectionReason: { type: DataTypes.STRING, defaultValue: null },
  createdAt: DataTypes.STRING,
  verifiedAt: { type: DataTypes.STRING, defaultValue: null },
}, { tableName: 'payments', timestamps: false });

module.exports = Payment;
