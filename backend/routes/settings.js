const express = require('express');
const Settings = require('../models/Settings');
const { verifyToken, requireRole } = require('../middleware/auth');
const { clean } = require('../utils/dbHelpers');

const router = express.Router();

// GET /api/settings/payment - any logged-in account can read the UPI details needed to pay
router.get('/payment', verifyToken, async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({ upiId: '', payeeName: 'Smart Ride' });
  res.json({ success: true, settings: clean(settings) });
});

// PUT /api/settings/payment - admin only, configure where payments should land
router.put('/payment', verifyToken, requireRole('admin'), async (req, res) => {
  const { upiId, payeeName } = req.body;
  if (!upiId || !upiId.trim() || !upiId.includes('@')) {
    return res.status(400).json({ success: false, message: 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank).' });
  }

  let settings = await Settings.findOne();
  if (!settings) settings = Settings.build({});
  settings.upiId = upiId.trim();
  settings.payeeName = (payeeName || 'Smart Ride').trim();
  await settings.save();

  res.json({ success: true, message: 'Payment settings updated.', settings: clean(settings) });
});

module.exports = router;
