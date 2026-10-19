const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Message = require('../models/Message');
const Subscription = require('../models/Subscription');
const { verifyToken, requireRole } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { clean, cleanAll } = require('../utils/dbHelpers');

const router = express.Router();

const MAX_MESSAGE_LENGTH = 1000;

async function getAuthorizedSubscription(subscriptionId, user) {
  const sub = await Subscription.findOne({ where: { id: subscriptionId } });
  if (!sub) return null;
  if (user.role === 'user' && sub.userId === user.id) return sub;
  if (user.role === 'driver' && sub.driverId === user.id) return sub;
  return null;
}

// GET /api/chat/:subscriptionId - message history, oldest first
router.get('/:subscriptionId', verifyToken, requireRole('user', 'driver'), async (req, res) => {
  const sub = await getAuthorizedSubscription(req.params.subscriptionId, req.user);
  if (!sub) return res.status(403).json({ success: false, message: 'You do not have access to this chat.' });

  const messages = await Message.findAll({ where: { subscriptionId: sub.id }, order: [['createdAt', 'ASC']] });
  res.json({ success: true, messages: cleanAll(messages) });
});

// POST /api/chat/:subscriptionId - send a message
router.post('/:subscriptionId', verifyToken, requireRole('user', 'driver'), async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Message text is required.' });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ success: false, message: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
  }

  const sub = await getAuthorizedSubscription(req.params.subscriptionId, req.user);
  if (!sub) return res.status(403).json({ success: false, message: 'You do not have access to this chat.' });
  if (!sub.driverId) return res.status(400).json({ success: false, message: 'Chat is only available once a driver is assigned.' });

  const message = await Message.create({
    id: 'msg-' + uuidv4(),
    subscriptionId: sub.id,
    senderId: req.user.id,
    senderRole: req.user.role,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  });

  const recipientId = req.user.role === 'user' ? sub.driverId : sub.userId;
  const senderLabel = req.user.role === 'user' ? 'your rider' : 'your driver';
  const preview = message.text.length > 60 ? message.text.slice(0, 60) + '…' : message.text;
  await pushNotification(recipientId, `New message from ${senderLabel}: "${preview}"`);

  res.status(201).json({ success: true, message: clean(message) });
});

module.exports = router;
