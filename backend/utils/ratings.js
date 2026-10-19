const Rating = require('../models/Rating');

async function avgRating(driverId) {
  const list = await Rating.findAll({ where: { driverId } });
  if (list.length === 0) return null;
  const sum = list.reduce((s, r) => s + r.stars, 0);
  return Math.round((sum / list.length) * 10) / 10;
}

module.exports = { avgRating };
