const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Plan = require('../models/Plan');
const TripStatusModel = require('../models/TripStatus');
const Attendance = require('../models/Attendance');
const Rating = require('../models/Rating');
const { verifyToken, requireRole } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { todayStr, getTodayStatus } = require('../utils/tripStatus');
const { avgRating } = require('../utils/ratings');
const { clean, cleanAll } = require('../utils/dbHelpers');

const router = express.Router();

const DRIVER_SHARE = 0.75; // driver keeps 75% of subscription fee, platform keeps 25%
const TRIP_STATUSES = ['on_the_way', 'arrived', 'picked_up', 'completed', 'missed'];
const STATUS_MESSAGE = {
  on_the_way: 'is on the way',
  arrived: 'has arrived at your pickup point',
  picked_up: 'has started your trip',
  completed: 'completed your trip',
  missed: "missed today's trip",
};

// GET /api/driver/my-subscriptions
router.get('/my-subscriptions', verifyToken, requireRole('driver'), async (req, res) => {
  const subs = await Subscription.findAll({ where: { driverId: req.user.id, status: 'active' } });
  const mine = [];
  for (const s of subs) {
    const user = await User.findOne({ where: { id: s.userId } });
    const plan = await Plan.findOne({ where: { id: s.planId } });
    mine.push({
      ...clean(s),
      riderName: user ? user.name : 'Unknown',
      riderPhone: user ? user.phone : '',
      planName: plan ? plan.name : '',
      todayStatus: await getTodayStatus(s.id),
    });
  }
  res.json({ success: true, subscriptions: mine });
});

// POST /api/driver/trip-status - update today's live trip status for an assigned rider
router.post('/trip-status', verifyToken, requireRole('driver'), async (req, res) => {
  const { subscriptionId, status } = req.body;
  if (!subscriptionId || !TRIP_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'subscriptionId and a valid status are required.' });
  }

  const sub = await Subscription.findOne({ where: { id: subscriptionId, driverId: req.user.id, status: 'active' } });
  if (!sub) return res.status(404).json({ success: false, message: 'Assigned active subscription not found.' });

  const date = todayStr();
  let rec = await TripStatusModel.findOne({ where: { subscriptionId, date } });
  if (!rec) {
    rec = await TripStatusModel.create({ id: 'trip-' + uuidv4(), subscriptionId, date, status, updatedAt: new Date().toISOString() });
  } else {
    rec.status = status;
    rec.updatedAt = new Date().toISOString();
    await rec.save();
  }

  // Terminal states also log a historical attendance record (used for the Attendance Log + earnings)
  if (status === 'completed' || status === 'missed') {
    await Attendance.create({
      id: 'att-' + uuidv4(),
      driverId: req.user.id,
      subscriptionId,
      date,
      status,
      note: '',
      createdAt: new Date().toISOString(),
    });
  }

  await pushNotification(sub.userId, `Your driver ${STATUS_MESSAGE[status] || 'updated your trip status'}.`);

  res.json({ success: true, message: 'Trip status updated.', tripStatus: clean(rec) });
});

// GET /api/driver/attendance
router.get('/attendance', verifyToken, requireRole('driver'), async (req, res) => {
  const mine = await Attendance.findAll({ where: { driverId: req.user.id }, order: [['createdAt', 'DESC']] });
  res.json({ success: true, attendance: cleanAll(mine) });
});

// GET /api/driver/reviews
router.get('/reviews', verifyToken, requireRole('driver'), async (req, res) => {
  const ratings = await Rating.findAll({ where: { driverId: req.user.id }, order: [['createdAt', 'DESC']] });
  const mine = [];
  for (const r of ratings) {
    const user = await User.findOne({ where: { id: r.userId } });
    mine.push({ ...clean(r), riderName: user ? user.name : 'Rider' });
  }
  res.json({ success: true, reviews: mine, average: await avgRating(req.user.id), count: mine.length });
});

// GET /api/driver/earnings
router.get('/earnings', verifyToken, requireRole('driver'), async (req, res) => {
  const mySubs = await Subscription.findAll({ where: { driverId: req.user.id, status: 'active' } });

  let totalRevenue = 0;
  const breakdown = [];
  for (const s of mySubs) {
    const plan = await Plan.findOne({ where: { id: s.planId } });
    const price = plan ? plan.price : 0;
    totalRevenue += price;
    const tripsCompleted = await Attendance.count({ where: { subscriptionId: s.id, status: 'completed' } });
    breakdown.push({ subscriptionId: s.id, planName: plan ? plan.name : '', price, tripsCompleted });
  }

  const earnings = Math.round(totalRevenue * DRIVER_SHARE);

  res.json({
    success: true,
    activeRiders: mySubs.length,
    totalRevenueGenerated: totalRevenue,
    driverSharePercent: DRIVER_SHARE * 100,
    estimatedEarnings: earnings,
    averageRating: await avgRating(req.user.id),
    breakdown,
  });
});

module.exports = router;
