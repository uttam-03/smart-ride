const express = require('express');
const Subscription = require('../models/Subscription');
const TripStatus = require('../models/TripStatus');
const { verifyToken, requireRole } = require('../middleware/auth');
const { todayStr } = require('../utils/tripStatus');
const router = express.Router();

router.post('/:subscriptionId/location', verifyToken, requireRole('driver'), async (req, res) => {
  const { latitude, longitude, accuracy } = req.body || {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required.' });
  const sub = await Subscription.findOne({ where: { id: req.params.subscriptionId, driverId: req.user.id, status: 'active' } });
  if (!sub) return res.status(404).json({ success: false, message: 'Assigned active subscription not found.' });
  const date = todayStr();
  let trip = await TripStatus.findOne({ where: { subscriptionId: sub.id, date } });
  if (!trip) trip = await TripStatus.create({ id: `trip-${sub.id}-${date}`, subscriptionId: sub.id, date, status: 'on_the_way', updatedAt: new Date().toISOString() });
  trip.latitude = latitude; trip.longitude = longitude;
  trip.accuracy = Number.isFinite(accuracy) ? Math.max(0, accuracy) : null;
  trip.locationUpdatedAt = new Date().toISOString();
  await trip.save();
  return res.json({ success: true, message: 'Location updated.', locationUpdatedAt: trip.locationUpdatedAt });
});

router.get('/:subscriptionId', verifyToken, requireRole('user'), async (req, res) => {
  const sub = await Subscription.findOne({ where: { id: req.params.subscriptionId, userId: req.user.id, status: 'active' } });
  if (!sub) return res.status(404).json({ success: false, message: 'Active subscription not found.' });
  if (!sub.driverId) return res.status(404).json({ success: false, message: 'A driver has not been assigned yet.' });
  const trip = await TripStatus.findOne({ where: { subscriptionId: sub.id, date: todayStr() } });
  if (!trip || trip.latitude == null || trip.longitude == null) return res.json({ success: true, tracking: false, message: 'Waiting for the driver to share their location.', pickup: { latitude: sub.pickupLat, longitude: sub.pickupLng }, drop: { latitude: sub.dropLat, longitude: sub.dropLng } });
  return res.json({ success: true, tracking: true, location: { latitude: trip.latitude, longitude: trip.longitude, accuracy: trip.accuracy, updatedAt: trip.locationUpdatedAt }, status: trip.status, pickup: { latitude: sub.pickupLat, longitude: sub.pickupLng }, drop: { latitude: sub.dropLat, longitude: sub.dropLng } });
});
module.exports = router;
