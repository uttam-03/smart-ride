const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Complaint = require('../models/Complaint');
const { verifyToken, requireRole } = require('../middleware/auth');
const { clean, cleanAll } = require('../utils/dbHelpers');

const router = express.Router();

// POST /api/complaints - a user or driver raises a complaint/feedback
router.post('/', verifyToken, requireRole('user', 'driver'), async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ success: false, message: 'subject and message are required.' });
  }

  const complaint = await Complaint.create({
    id: 'cmp-' + uuidv4(),
    raisedBy: req.user.id,
    raisedByRole: req.user.role,
    subject,
    message,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });

  res.status(201).json({ success: true, message: 'Complaint submitted. Our team will review it shortly.', complaint: clean(complaint) });
});

// GET /api/complaints/mine
router.get('/mine', verifyToken, requireRole('user', 'driver'), async (req, res) => {
  const mine = await Complaint.findAll({ where: { raisedBy: req.user.id }, order: [['createdAt', 'DESC']] });
  res.json({ success: true, complaints: cleanAll(mine) });
});

module.exports = router;
