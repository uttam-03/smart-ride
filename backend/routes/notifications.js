const express = require('express');
const Notification = require('../models/Notification');
const { verifyToken } = require('../middleware/auth');
const { cleanAll } = require('../utils/dbHelpers');

const router = express.Router();

// GET /api/notifications/mine
router.get('/mine', verifyToken, async (req, res) => {
  const mine = await Notification.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
  res.json({ success: true, notifications: cleanAll(mine) });
});

// POST /api/notifications/mark-read
router.post('/mark-read', verifyToken, async (req, res) => {
  await Notification.update({ read: true }, { where: { userId: req.user.id } });
  res.json({ success: true, message: 'Notifications marked as read.' });
});

module.exports = router;
