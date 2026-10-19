require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const seedDatabase = require('./config/seed');
const startReminderScheduler = require('./config/reminders');

const { router: authRouter } = require('./routes/auth');
const plansRouter = require('./routes/plans');
const subscriptionsRouter = require('./routes/subscriptions');
const paymentsRouter = require('./routes/payments');
const driverRouter = require('./routes/driver');
const adminRouter = require('./routes/admin');
const complaintsRouter = require('./routes/complaints');
const notificationsRouter = require('./routes/notifications');
const settingsRouter = require('./routes/settings');
const ratingsRouter = require('./routes/ratings');
const chatRouter = require('./routes/chat');
const trackingRouter = require('./routes/tracking');

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Security headers ----
// CSP is disabled: the frontend is plain HTML with inline <script> blocks and
// inline onclick= handlers throughout, plus CDN resources (fonts, Leaflet,
// QRCode). A default CSP blocks all of that. Other helmet protections
// (X-Content-Type-Options, X-Frame-Options, etc.) stay on.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors());
app.use(express.json());

// ---- Rate limiting ----
// Tight limit on auth endpoints (brute-force protection). Generous limit on
// everything else so chat/notification polling (every few seconds while a
// page is open) never gets blocked during normal use.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please wait a few minutes and try again.' },
});
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', generalLimiter);

// ---- API routes ----
app.use('/api/auth', authRouter);
app.use('/api/plans', plansRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/driver', driverRouter);
app.use('/api/admin', adminRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/tracking', trackingRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Smart Ride API is running.', time: new Date().toISOString() });
});

// ---- Serve frontend (plain HTML/CSS/JS) ----
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// Fallback: any unknown non-API route goes to the landing page
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Unexpected server error.' });
});

async function start() {
  await connectDB();
  await seedDatabase();
  startReminderScheduler();

  app.listen(PORT, () => {
    console.log('==========================================================');
    console.log(' Smart Ride - Monthly Pickup & Drop Subscription Platform');
    console.log('==========================================================');
    console.log(` Server running at: http://localhost:${PORT}`);
    console.log(` Admin login: admin@smartride.com / admin123`);
    console.log('==========================================================');
  });
}

start();
