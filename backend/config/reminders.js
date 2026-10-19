const { Op } = require('sequelize');
const Subscription = require('../models/Subscription');
const { pushNotification } = require('../utils/notify');

const REMINDER_WINDOW_DAYS = 3;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check hourly; idempotent via renewalReminderSent flag

async function checkRenewalReminders() {
  try {
    const now = Date.now();
    const windowEnd = now + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const activeSubs = await Subscription.findAll({
      where: { status: 'active', renewalReminderSent: false },
    });

    for (const sub of activeSubs) {
      if (!sub.endDate) continue;
      const endTime = new Date(sub.endDate).getTime();
      if (endTime <= windowEnd && endTime > now) {
        const daysLeft = Math.ceil((endTime - now) / (24 * 60 * 60 * 1000));
        await pushNotification(
          sub.userId,
          `Your subscription ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${sub.pickup} → ${sub.drop}). Renew now to avoid a gap in service.`
        );
        sub.renewalReminderSent = true;
        await sub.save();
      }
    }
  } catch (err) {
    console.error('Renewal reminder check failed:', err.message);
  }
}

function startReminderScheduler() {
  setTimeout(checkRenewalReminders, 10 * 1000);
  setInterval(checkRenewalReminders, CHECK_INTERVAL_MS);
}

module.exports = startReminderScheduler;
