const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Admin = require('../models/Admin');
const Plan = require('../models/Plan');
const Settings = require('../models/Settings');

async function seedDatabase() {
  const adminCount = await Admin.count();
  if (adminCount === 0) {
    const hashed = await bcrypt.hash('admin123', 10);
    await Admin.create({
      id: 'admin-' + uuidv4(),
      name: 'System Admin',
      email: 'admin@smartride.com',
      password: hashed,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    console.log('🌱 Seeded default admin: admin@smartride.com / admin123');
  }

  const planCount = await Plan.count();
  if (planCount === 0) {
    await Plan.bulkCreate([
      { id: 'plan-monthly', name: 'Monthly Plan', durationDays: 30, price: 2500, description: 'Fixed daily pickup & drop for 30 days with the same driver and vehicle.' },
      { id: 'plan-quarterly', name: 'Quarterly Plan', durationDays: 90, price: 7000, description: '3 months of consistent daily commute service. Save compared to monthly billing.' },
      { id: 'plan-yearly', name: 'Yearly Plan', durationDays: 365, price: 25000, description: 'Full year of dependable commuting with priority driver assignment and support.' },
    ]);
    console.log('🌱 Seeded subscription plans');
  }

  const settingsCount = await Settings.count();
  if (settingsCount === 0) {
    await Settings.create({ upiId: '', payeeName: 'Smart Ride' });
    console.log('🌱 Seeded default payment settings');
  }
}

module.exports = seedDatabase;
