const TripStatus = require('../models/TripStatus');

// Live, same-day trip status for an active subscription (resets naturally each
// day since records are keyed by date — no cleanup job needed).
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getTodayStatus(subscriptionId) {
  const rec = await TripStatus.findOne({ where: { subscriptionId, date: todayStr() } });
  return rec ? rec.status : 'not_started';
}

module.exports = { todayStr, getTodayStatus };
