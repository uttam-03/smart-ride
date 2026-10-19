const express = require('express');
const { Op } = require('sequelize');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Complaint = require('../models/Complaint');
const Message = require('../models/Message');
const { verifyToken, requireRole } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { pickBestDriver, getDriverRecommendations } = require('../utils/assignDriver');
const { avgRating } = require('../utils/ratings');
const { clean } = require('../utils/dbHelpers');

const router = express.Router();
router.use(verifyToken, requireRole('admin'));

function safe(doc) {
  const obj = clean(doc);
  delete obj.password;
  return obj;
}

// ---- Plan management (subscription & pricing control) ----

// POST /api/admin/plans - create a new plan
router.post('/plans', async (req, res) => {
  const { name, durationDays, price, description } = req.body;
  const days = Number(durationDays);
  const amount = Number(price);

  if (!name || !name.trim() || !Number.isFinite(days) || days <= 0 || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'A valid name, durationDays (>0) and price (>0) are required.' });
  }

  const plan = await Plan.create({
    id: 'plan-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-5),
    name: name.trim(),
    durationDays: days,
    price: amount,
    description: (description || '').trim(),
  });

  res.status(201).json({ success: true, message: 'Plan created.', plan: clean(plan) });
});

// PUT /api/admin/plans/:id - edit an existing plan (including price changes)
router.put('/plans/:id', async (req, res) => {
  const plan = await Plan.findOne({ where: { id: req.params.id } });
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });

  const { name, durationDays, price, description } = req.body;
  if (name !== undefined) plan.name = name.trim();
  if (description !== undefined) plan.description = description.trim();
  if (durationDays !== undefined) {
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ success: false, message: 'durationDays must be a positive number.' });
    plan.durationDays = days;
  }
  if (price !== undefined) {
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'price must be a positive number.' });
    plan.price = amount;
  }

  await plan.save();
  res.json({ success: true, message: 'Plan updated.', plan: clean(plan) });
});

// DELETE /api/admin/plans/:id - retire a plan (blocked if any subscription still references it)
router.delete('/plans/:id', async (req, res) => {
  const plan = await Plan.findOne({ where: { id: req.params.id } });
  if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });

  const inUse = await Subscription.count({ where: { planId: plan.id } });
  if (inUse > 0) {
    return res.status(400).json({ success: false, message: `Cannot delete — ${inUse} subscription(s) reference this plan. Edit its price instead, or leave it for historical records.` });
  }

  await Plan.destroy({ where: { id: plan.id } });
  res.json({ success: true, message: 'Plan deleted.' });
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const users = await User.findAll();
  res.json({ success: true, users: users.map(safe) });
});

// GET /api/admin/drivers
router.get('/drivers', async (req, res) => {
  const drivers = await Driver.findAll();
  const result = [];
  for (const d of drivers) {
    result.push({ ...safe(d), avgRating: await avgRating(d.id) });
  }
  res.json({ success: true, drivers: result });
});

// POST /api/admin/drivers/:id/verify
router.post('/drivers/:id/verify', async (req, res) => {
  const driver = await Driver.findOne({ where: { id: req.params.id } });
  if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

  driver.verified = true;
  await driver.save();
  await pushNotification(driver.id, 'Your driver profile has been verified. You can now be assigned to riders.');
  res.json({ success: true, message: 'Driver verified.', driver: safe(driver) });
});

// POST /api/admin/drivers/:id/unverify
router.post('/drivers/:id/unverify', async (req, res) => {
  const driver = await Driver.findOne({ where: { id: req.params.id } });
  if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

  driver.verified = false;
  await driver.save();
  res.json({ success: true, message: 'Driver verification revoked.', driver: safe(driver) });
});

// GET /api/admin/subscriptions
router.get('/subscriptions', async (req, res) => {
  const subs = await Subscription.findAll();
  const result = [];
  for (const s of subs) {
    const user = await User.findOne({ where: { id: s.userId } });
    const driver = s.driverId ? await Driver.findOne({ where: { id: s.driverId } }) : null;
    const plan = await Plan.findOne({ where: { id: s.planId } });
    result.push({
      ...clean(s),
      userName: user ? user.name : 'Unknown',
      driverName: driver ? driver.name : null,
      planName: plan ? plan.name : 'Unknown',
      planPrice: plan ? plan.price : 0,
    });
  }
  res.json({ success: true, subscriptions: result });
});

// GET /api/admin/subscriptions/:id/driver-recommendations - route-aware driver shortlist
router.get('/subscriptions/:id/driver-recommendations', async (req, res) => {
  const sub = await Subscription.findOne({ where: { id: req.params.id } });
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
  if (sub.status !== 'active') return res.status(400).json({ success: false, message: 'Only active subscriptions can be assigned a driver.' });
  const result = await getDriverRecommendations(sub);
  res.json({ success: true, subscriptionId: sub.id, ...result });
});

// POST /api/admin/subscriptions/:id/auto-assign-driver - assign the highest-ranked route match
router.post('/subscriptions/:id/auto-assign-driver', async (req, res) => {
  const sub = await Subscription.findOne({ where: { id: req.params.id } });
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
  if (sub.status !== 'active') return res.status(400).json({ success: false, message: 'Only active subscriptions can be assigned a driver.' });
  const result = await getDriverRecommendations(sub);
  const best = result.recommendations[0];
  if (!best) return res.status(409).json({ success: false, message: result.reason, recommendations: [] });
  const driver = await Driver.findOne({ where: { id: best.driverId, verified: true } });
  if (!driver) return res.status(409).json({ success: false, message: 'Recommended driver is no longer available. Refresh and try again.' });
  const oldDriverId = sub.driverId;
  sub.driverId = driver.id;
  await sub.save();
  await pushNotification(sub.userId, `Your driver is ${driver.name} (${driver.vehicleNumber || 'vehicle details pending'}). Assignment is based on route and workload matching.`);
  await pushNotification(driver.id, `New rider assigned: ${sub.pickup} → ${sub.drop}, pickup time ${sub.preferredTime || 'not specified'}.`);
  if (oldDriverId && oldDriverId !== driver.id) await pushNotification(oldDriverId, `A rider has been reassigned to another driver.`);
  res.json({ success: true, message: 'Best route-matched driver assigned.', driver: safe(driver), reasons: best.reasons, subscription: clean(sub) });
});

// POST /api/admin/subscriptions/:id/assign-driver
router.post('/subscriptions/:id/assign-driver', async (req, res) => {
  const { driverId } = req.body;
  if (!driverId) return res.status(400).json({ success: false, message: 'driverId is required.' });

  const sub = await Subscription.findOne({ where: { id: req.params.id } });
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });

  const driver = await Driver.findOne({ where: { id: driverId } });
  if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });
  if (!driver.verified) return res.status(400).json({ success: false, message: 'Cannot assign an unverified driver.' });

  sub.driverId = driverId;
  await sub.save();
  await pushNotification(sub.userId, `Your driver has been updated to ${driver.name} (${driver.vehicleNumber}).`);
  await pushNotification(driver.id, `You have been assigned a new rider (route: ${sub.pickup} → ${sub.drop}).`);

  res.json({ success: true, message: 'Driver assigned.', subscription: clean(sub) });
});

// GET /api/admin/complaints
router.get('/complaints', async (req, res) => {
  const complaints = await Complaint.findAll({ order: [['createdAt', 'DESC']] });
  const result = [];
  for (const c of complaints) {
    const raiser = c.raisedByRole === 'user'
      ? await User.findOne({ where: { id: c.raisedBy } })
      : await Driver.findOne({ where: { id: c.raisedBy } });
    result.push({ ...clean(c), raiserName: raiser ? raiser.name : 'Unknown' });
  }
  res.json({ success: true, complaints: result });
});

// POST /api/admin/complaints/:id/resolve
router.post('/complaints/:id/resolve', async (req, res) => {
  const complaint = await Complaint.findOne({ where: { id: req.params.id } });
  if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

  complaint.status = 'resolved';
  complaint.resolvedAt = new Date().toISOString();
  await complaint.save();
  await pushNotification(complaint.raisedBy, `Your complaint "${complaint.subject}" has been resolved.`);
  res.json({ success: true, message: 'Complaint marked resolved.', complaint: clean(complaint) });
});

// GET /api/admin/chat/:subscriptionId - read-only oversight of a rider/driver chat
router.get('/chat/:subscriptionId', async (req, res) => {
  const sub = await Subscription.findOne({ where: { id: req.params.subscriptionId } });
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });

  const messages = await Message.findAll({ where: { subscriptionId: sub.id }, order: [['createdAt', 'ASC']] });
  const result = [];
  for (const m of messages) {
    const senderAccount = m.senderRole === 'user'
      ? await User.findOne({ where: { id: m.senderId } })
      : await Driver.findOne({ where: { id: m.senderId } });
    result.push({ ...clean(m), senderName: senderAccount ? senderAccount.name : 'Unknown' });
  }
  res.json({ success: true, messages: result });
});

// GET /api/admin/payments - all payment submissions, most recent first
router.get('/payments', async (req, res) => {
  const payments = await Payment.findAll({ order: [['createdAt', 'DESC']] });
  const result = [];
  for (const p of payments) {
    const user = await User.findOne({ where: { id: p.userId } });
    const sub = await Subscription.findOne({ where: { id: p.subscriptionId } });
    const plan = sub ? await Plan.findOne({ where: { id: sub.planId } }) : null;
    result.push({
      ...clean(p),
      userName: user ? user.name : 'Unknown',
      userPhone: user ? user.phone : '',
      userEmail: user ? user.email : '',
      planName: plan ? plan.name : 'Unknown',
      route: sub ? `${sub.pickup} → ${sub.drop}` : '',
    });
  }
  res.json({ success: true, payments: result });
});

// POST /api/admin/payments/:id/verify - confirm you received the money, activate the subscription
router.post('/payments/:id/verify', async (req, res) => {
  const payment = await Payment.findOne({ where: { id: req.params.id } });
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
  if (payment.status !== 'pending_verification') {
    return res.status(400).json({ success: false, message: `Payment already ${payment.status}.` });
  }

  const sub = await Subscription.findOne({ where: { id: payment.subscriptionId } });
  if (!sub) return res.status(404).json({ success: false, message: 'Related subscription not found.' });

  const plan = await Plan.findOne({ where: { id: sub.planId } });

  payment.status = 'verified';
  payment.verifiedAt = new Date().toISOString();
  payment.invoiceNumber = 'INV-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 900 + 100);
  await payment.save();

  const start = new Date();
  const end = new Date(start.getTime() + (plan ? plan.durationDays : 30) * 24 * 60 * 60 * 1000);
  sub.status = 'active';
  sub.startDate = start.toISOString();
  sub.endDate = end.toISOString();

  const driver = await pickBestDriver(sub.city, sub);
  if (driver) {
    sub.driverId = driver.id;
    await pushNotification(sub.userId, `Payment verified! Invoice ${payment.invoiceNumber}. Driver ${driver.name} (${driver.vehicleNumber}) has been assigned.`);
    await pushNotification(driver.id, `New rider assigned: pickup at "${sub.pickup}" to "${sub.drop}".`);
  } else {
    await pushNotification(sub.userId, `Payment verified! Invoice ${payment.invoiceNumber}. A driver will be assigned shortly.`);
  }
  await sub.save();

  res.json({ success: true, message: 'Payment verified and subscription activated.', payment: clean(payment), subscription: clean(sub) });
});

// POST /api/admin/payments/:id/reject - could not confirm the payment
router.post('/payments/:id/reject', async (req, res) => {
  const { reason } = req.body;
  const payment = await Payment.findOne({ where: { id: req.params.id } });
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
  if (payment.status !== 'pending_verification') {
    return res.status(400).json({ success: false, message: `Payment already ${payment.status}.` });
  }

  payment.status = 'rejected';
  payment.rejectionReason = (reason || '').trim() || 'Could not verify this transaction.';
  await payment.save();
  await pushNotification(payment.userId, `Your payment (UTR: ${payment.utrNumber}) could not be verified: ${payment.rejectionReason}. Please resubmit with the correct details.`);

  res.json({ success: true, message: 'Payment marked as rejected.', payment: clean(payment) });
});

// GET /api/admin/analytics - KPIs
router.get('/analytics', async (req, res) => {
  const activeSubs = await Subscription.findAll({ where: { status: 'active' } });
  const totalSubsEver = await Subscription.count();

  let mrr = 0;
  for (const s of activeSubs) {
    const plan = await Plan.findOne({ where: { id: s.planId } });
    if (plan) mrr += (plan.price / plan.durationDays) * 30;
  }

  const cancelledSubs = await Subscription.count({ where: { status: 'cancelled' } });
  const retentionRate = totalSubsEver > 0
    ? Math.round(((totalSubsEver - cancelledSubs) / totalSubsEver) * 100)
    : 100;

  const verifiedDrivers = await Driver.findAll({ where: { verified: true } });
  const driversWithRidersSet = new Set(activeSubs.map(s => s.driverId).filter(Boolean));
  const driverUtilization = verifiedDrivers.length > 0
    ? Math.round((driversWithRidersSet.size / verifiedDrivers.length) * 100)
    : 0;

  const resolvedComplaints = (await Complaint.findAll({ where: { status: 'resolved' } })).filter(c => c.resolvedAt);
  let avgResolutionHours = 0;
  if (resolvedComplaints.length > 0) {
    const totalHours = resolvedComplaints.reduce((sum, c) => {
      const created = new Date(c.createdAt).getTime();
      const closed = new Date(c.resolvedAt).getTime();
      return sum + (closed - created) / (1000 * 60 * 60);
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedComplaints.length) * 10) / 10;
  }

  const totalUsers = await User.count();
  const totalDrivers = await Driver.count();
  const openComplaints = await Complaint.count({ where: { status: { [Op.ne]: 'resolved' } } });
  const pendingPaymentVerifications = await Payment.count({ where: { status: 'pending_verification' } });
  const verifiedPayments = await Payment.findAll({ where: { status: 'verified' } });
  const totalPaymentsCollected = verifiedPayments.reduce((sum, p) => sum + p.amount, 0);

  res.json({
    success: true,
    analytics: {
      activeSubscriptions: activeSubs.length,
      totalUsers,
      totalDrivers,
      verifiedDrivers: verifiedDrivers.length,
      monthlyRecurringRevenue: Math.round(mrr),
      userRetentionRate: retentionRate,
      driverUtilizationRate: driverUtilization,
      openComplaints,
      avgComplaintResolutionHours: avgResolutionHours,
      totalPaymentsCollected,
      pendingPaymentVerifications,
    },
  });
});

module.exports = router;
