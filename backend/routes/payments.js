const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Admin = require('../models/Admin');
const { verifyToken, requireRole } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { clean } = require('../utils/dbHelpers');

const router = express.Router();

// POST /api/payments/upi-request
router.post('/upi-request', verifyToken, requireRole('user'), async (req, res) => {
  try {
    const { subscriptionId, utrNumber, payerUpiId, payerName, note } = req.body;

    if (!subscriptionId || !utrNumber || !utrNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Subscription and UPI transaction / reference number are required.' });
    }
    if (!payerUpiId || !payerUpiId.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter the UPI ID you paid from — it helps us verify your payment faster.' });
    }
    if (!payerName || !payerName.trim()) {
      return res.status(400).json({ success: false, message: 'Please enter the name shown on your UPI payment.' });
    }

    const sub = await Subscription.findOne({ where: { id: subscriptionId, userId: req.user.id } });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
    if (sub.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: `This subscription is not awaiting payment (status: ${sub.status}).` });
    }

    const plan = await Plan.findOne({ where: { id: sub.planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found for this subscription.' });

    const existingPending = await Payment.findOne({ where: { subscriptionId: sub.id, status: 'pending_verification' } });
    if (existingPending) {
      return res.status(400).json({ success: false, message: 'A payment for this subscription is already awaiting verification.' });
    }

    const payment = await Payment.create({
      id: 'pay-' + uuidv4(),
      subscriptionId: sub.id,
      userId: req.user.id,
      amount: plan.price,
      method: 'UPI',
      utrNumber: utrNumber.trim(),
      payerUpiId: payerUpiId.trim(),
      payerName: payerName.trim(),
      note: (note || '').trim(),
      status: 'pending_verification',
      invoiceNumber: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      verifiedAt: null,
    });

    await pushNotification(req.user.id, `Payment submitted (UTR: ${payment.utrNumber}) for ${plan.name}. We'll activate your subscription once it's verified.`);
    const admins = await Admin.findAll();
    for (const a of admins) {
      await pushNotification(a.id, `New UPI payment awaiting verification — ${plan.name}, ₹${plan.price} from ${payment.payerName} (UTR: ${payment.utrNumber}).`);
    }

    res.status(201).json({ success: true, message: 'Payment submitted. Your subscription will activate once the admin verifies it.', payment: clean(payment) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error submitting payment.' });
  }
});

// GET /api/payments/mine
router.get('/mine', verifyToken, requireRole('user'), async (req, res) => {
  const payments = await Payment.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
  const mine = [];
  for (const p of payments) {
    const sub = await Subscription.findOne({ where: { id: p.subscriptionId } });
    const plan = sub ? await Plan.findOne({ where: { id: sub.planId } }) : null;
    mine.push({ ...clean(p), planName: plan ? plan.name : 'Unknown' });
  }
  res.json({ success: true, payments: mine });
});

module.exports = router;
