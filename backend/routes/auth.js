const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Admin = require('../models/Admin');
const { verifyToken } = require('../middleware/auth');
const { clean } = require('../utils/dbHelpers');

const router = express.Router();

function modelForRole(role) {
  if (role === 'user') return User;
  if (role === 'driver') return Driver;
  if (role === 'admin') return Admin;
  return null;
}

// Looks up an account by email OR phone number, across all three roles.
// Admin accounts have no phone field, so they're only reachable by email.
async function findAccountByIdentifier(identifier) {
  const raw = String(identifier).trim();
  const lower = raw.toLowerCase();

  const [userByEmail, driverByEmail, adminByEmail, userByPhone, driverByPhone] = await Promise.all([
    User.findOne({ where: { email: lower } }),
    Driver.findOne({ where: { email: lower } }),
    Admin.findOne({ where: { email: lower } }),
    User.findOne({ where: { phone: raw } }),
    Driver.findOne({ where: { phone: raw } }),
  ]);

  if (userByEmail) return { doc: userByEmail, role: 'user' };
  if (driverByEmail) return { doc: driverByEmail, role: 'driver' };
  if (adminByEmail) return { doc: adminByEmail, role: 'admin' };
  if (userByPhone) return { doc: userByPhone, role: 'user' };
  if (driverByPhone) return { doc: driverByPhone, role: 'driver' };
  return null;
}

function signToken(account, role) {
  return jwt.sign(
    { id: account.id, role, name: account.name, email: account.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitize(doc) {
  const obj = clean(doc);
  delete obj.password;
  return obj;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { role, name, email, phone, password, pickup, drop, city, vehicleType, vehicleNumber, licenseNumber } = req.body;

    if (!['user', 'driver'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be "user" or "driver".' });
    }
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, phone and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existingByEmail = await findAccountByIdentifier(email);
    const existingByPhone = await findAccountByIdentifier(phone);
    if (existingByEmail || existingByPhone) {
      return res.status(409).json({ success: false, message: 'An account with this email or phone number already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    let account;
    if (role === 'user') {
      account = await User.create({
        id: 'user-' + uuidv4(), name, email: email.toLowerCase(), phone, password: hashed,
        pickup: pickup || '', drop: drop || '', city: city || '', role: 'user', createdAt: now,
      });
    } else {
      account = await Driver.create({
        id: 'driver-' + uuidv4(), name, email: email.toLowerCase(), phone, password: hashed,
        vehicleType: vehicleType || '', vehicleNumber: vehicleNumber || '', licenseNumber: licenseNumber || '',
        city: city || '', verified: false, role: 'driver', createdAt: now,
      });
    }

    const token = signToken(account, role);
    return res.status(201).json({ success: true, message: 'Registration successful.', token, account: sanitize(account) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login - accepts email OR mobile number in the "email" field
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email/mobile number and password are required.' });
    }

    const found = await findAccountByIdentifier(email);
    if (!found) {
      return res.status(401).json({ success: false, message: 'Invalid email/mobile number or password.' });
    }

    const match = await bcrypt.compare(password, found.doc.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email/mobile number or password.' });
    }

    const token = signToken(found.doc, found.role);
    return res.json({ success: true, message: 'Login successful.', token, account: sanitize(found.doc) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  const Model = modelForRole(req.user.role);
  const account = await Model.findOne({ where: { id: req.user.id } });
  if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });
  return res.json({ success: true, account: sanitize(account) });
});

// PUT /api/auth/profile - edit your own profile (role-aware fields)
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const Model = modelForRole(req.user.role);
    const account = await Model.findOne({ where: { id: req.user.id } });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });

    const { name, phone, city, pickup, drop, vehicleType, vehicleNumber, licenseNumber } = req.body;

    if (name !== undefined) account.name = name.trim();
    if (phone !== undefined) account.phone = phone.trim();
    if (city !== undefined) account.city = city.trim();

    if (req.user.role === 'user') {
      if (pickup !== undefined) account.pickup = pickup.trim();
      if (drop !== undefined) account.drop = drop.trim();
    }
    if (req.user.role === 'driver') {
      if (vehicleType !== undefined) account.vehicleType = vehicleType.trim();
      if (vehicleNumber !== undefined) account.vehicleNumber = vehicleNumber.trim();
      if (licenseNumber !== undefined) account.licenseNumber = licenseNumber.trim();
    }

    await account.save();
    res.json({ success: true, message: 'Profile updated.', account: sanitize(account) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
});

// PUT /api/auth/password - change your own password
router.put('/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const Model = modelForRole(req.user.role);
    const account = await Model.findOne({ where: { id: req.user.id } });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found.' });

    const match = await bcrypt.compare(currentPassword, account.password);
    if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    account.password = await bcrypt.hash(newPassword, 10);
    await account.save();
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

module.exports = { router };
