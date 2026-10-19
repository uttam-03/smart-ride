const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Driver = require('../models/Driver');
const Rating = require('../models/Rating');
const { verifyToken, requireRole } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { getTodayStatus } = require('../utils/tripStatus');
const { clean } = require('../utils/dbHelpers');

const router = express.Router();

// POST /api/subscriptions - create a new subscription (pending payment)
router.post('/', verifyToken, requireRole('user'), async (req, res) => {
  try {
    const { planId, pickup, drop, preferredTime, pickupLat, pickupLng, dropLat, dropLng, city } = req.body;
    if (!planId || !pickup || !drop) {
      return res.status(400).json({ success: false, message: 'planId, pickup and drop are required.' });
    }

    const plan = await Plan.findOne({ where: { id: planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Selected plan not found.' });

    const subscription = await Subscription.create({
      id: 'sub-' + uuidv4(),
      userId: req.user.id,
      planId,
      pickup,
      drop,
      pickupLat: typeof pickupLat === 'number' ? pickupLat : null,
      pickupLng: typeof pickupLng === 'number' ? pickupLng : null,
      dropLat: typeof dropLat === 'number' ? dropLat : null,
      dropLng: typeof dropLng === 'number' ? dropLng : null,
      preferredTime: preferredTime || '09:00 AM',
      city: city || '',
      driverId: null,
      status: 'pending_payment', // pending_payment -> active -> completed / cancelled
      startDate: null,
      endDate: null,
      renewalReminderSent: false,
      createdAt: new Date().toISOString(),
    });

    await pushNotification(req.user.id, `Subscription created for ${plan.name}. Complete payment to activate your service.`);

    res.status(201).json({ success: true, message: 'Subscription created. Proceed to payment.', subscription: clean(subscription) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating subscription.' });
  }
});

// POST /api/subscriptions/:id/renew - clone an existing subscription's route/plan into
// a fresh pending_payment subscription, so it goes through the normal payment flow again.
router.post('/:id/renew', verifyToken, requireRole('user'), async (req, res) => {
  try {
    const old = await Subscription.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!old) return res.status(404).json({ success: false, message: 'Subscription not found.' });

    const plan = await Plan.findOne({ where: { id: old.planId } });
    if (!plan) return res.status(404).json({ success: false, message: 'Original plan no longer exists.' });

    const renewed = await Subscription.create({
      id: 'sub-' + uuidv4(),
      userId: req.user.id,
      planId: old.planId,
      pickup: old.pickup,
      drop: old.drop,
      pickupLat: old.pickupLat,
      pickupLng: old.pickupLng,
      dropLat: old.dropLat,
      dropLng: old.dropLng,
      preferredTime: old.preferredTime,
      city: old.city,
      driverId: null,
      status: 'pending_payment',
      startDate: null,
      endDate: null,
      renewalReminderSent: false,
      createdAt: new Date().toISOString(),
    });

    await pushNotification(req.user.id, `Renewal created for ${plan.name}. Complete payment to continue your service without a gap.`);

    res.status(201).json({ success: true, message: 'Renewal subscription created. Proceed to payment.', subscription: clean(renewed) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error creating renewal.' });
  }
});

// GET /api/subscriptions/mine
router.get('/mine', verifyToken, requireRole('user'), async (req, res) => {
  const subs = await Subscription.findAll({ where: { userId: req.user.id } });
  const mine = [];
  for (const s of subs) {
    const plan = await Plan.findOne({ where: { id: s.planId } });
    const driver = s.driverId ? await Driver.findOne({ where: { id: s.driverId } }) : null;
    const myRating = await Rating.findOne({ where: { subscriptionId: s.id, userId: req.user.id } });
    mine.push({
      ...clean(s),
      planName: plan ? plan.name : 'Unknown Plan',
      planPrice: plan ? plan.price : 0,
      driverName: driver ? driver.name : null,
      driverPhone: driver ? driver.phone : null,
      vehicleNumber: driver ? driver.vehicleNumber : null,
      todayStatus: s.status === 'active' ? await getTodayStatus(s.id) : null,
      myRating: myRating ? myRating.stars : null,
      myRatingComment: myRating ? myRating.comment : null,
    });
  }
  res.json({ success: true, subscriptions: mine });
});

// POST /api/subscriptions/:id/cancel
router.post('/:id/cancel', verifyToken, requireRole('user'), async (req, res) => {
  const sub = await Subscription.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
  if (sub.status === 'cancelled') return res.status(400).json({ success: false, message: 'Subscription already cancelled.' });

  sub.status = 'cancelled';
  await sub.save();
  await pushNotification(req.user.id, 'Your subscription has been cancelled.');
  res.json({ success: true, message: 'Subscription cancelled.', subscription: clean(sub) });
});

module.exports = router;
