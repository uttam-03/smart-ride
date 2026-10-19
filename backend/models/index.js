// Requiring this file ensures every model is registered with the shared
// Sequelize instance before sequelize.sync() runs in config/db.js.
module.exports = {
  User: require('./User'),
  Driver: require('./Driver'),
  Admin: require('./Admin'),
  Plan: require('./Plan'),
  Subscription: require('./Subscription'),
  Payment: require('./Payment'),
  Attendance: require('./Attendance'),
  Complaint: require('./Complaint'),
  Notification: require('./Notification'),
  Settings: require('./Settings'),
  TripStatus: require('./TripStatus'),
  Rating: require('./Rating'),
  Message: require('./Message'),
};
