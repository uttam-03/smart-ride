const express = require('express');
const Plan = require('../models/Plan');
const { cleanAll } = require('../utils/dbHelpers');

const router = express.Router();

// GET /api/plans - public
router.get('/', async (req, res) => {
  const plans = await Plan.findAll();
  res.json({ success: true, plans: cleanAll(plans) });
});

module.exports = router;
