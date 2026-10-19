const { v4: uuidv4 } = require('uuid');
const Notification = require('../models/Notification');

async function pushNotification(userId, message) {
  await Notification.create({
    id: 'notif-' + uuidv4(),
    userId,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { pushNotification };
