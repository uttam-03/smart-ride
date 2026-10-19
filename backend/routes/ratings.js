const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Rating = require('../models/Rating');
const Subscription = require('../models/Subscription');
const { verifyToken, requireRole } = require('../middleware/auth');
const { pushNotification } = require('../utils/notify');
const { clean } = require('../utils/dbHelpers');

const router = express.Router();

// POST /api/ratings - rate the driver assigned to a subscription (one rating per
// subscription; submitting again updates it, so riders can revise their review).
router.post('/', verifyToken, requireRole('user'), async (req, res) => {
  const { subscriptionId, stars, comment } = req.body;
  const starsNum = Number(stars);

  if (!subscriptionId || !Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return res.status(400).json({ success: false, message: 'subscriptionId and a star rating from 1 to 5 are required.' });
  }

  const sub = await Subscription.findOne({ where: { id: subscriptionId, userId: req.user.id } });
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
  if (!sub.driverId) return res.status(400).json({ success: false, message: 'No driver has been assigned to this subscription yet.' });

  let rating = await Rating.findOne({ where: { subscriptionId, userId: req.user.id } });
  let isNew = false;

  if (rating) {
    rating.stars = starsNum;
    rating.comment = (comment || '').trim();
    rating.updatedAt = new Date().toISOString();
    await rating.save();
  } else {
    isNew = true;
    rating = await Rating.create({
      id: 'rate-' + uuidv4(),
      subscriptionId,
      userId: req.user.id,
      driverId: sub.driverId,
      stars: starsNum,
      comment: (comment || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (isNew) {
    await pushNotification(sub.driverId, `You received a new ${starsNum}-star rating from a rider.`);
  }

  res.status(201).json({ success: true, message: 'Rating submitted. Thank you!', rating: clean(rating) });
});

module.exports = router;
