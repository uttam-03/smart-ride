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

/*
|--------------------------------------------------------------------------
| SERVER CONFIGURATION
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

// Render runs the application behind a reverse proxy.
// Trust exactly one proxy hop so Express can correctly process
// X-Forwarded-For and express-rate-limit can identify clients.
app.set('trust proxy', 1);


/*
|--------------------------------------------------------------------------
| SECURITY HEADERS
|--------------------------------------------------------------------------
*/

// CSP is disabled because the current frontend uses:
// - inline <script>
// - inline onclick handlers
// - CDN resources
// - Leaflet
// - QRCode
// Other Helmet security protections remain enabled.

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(cors());


/*
|--------------------------------------------------------------------------
| BODY PARSING
|--------------------------------------------------------------------------
*/

app.use(express.json());


// Optional URL-encoded form support
app.use(express.urlencoded({ extended: true }));


/*
|--------------------------------------------------------------------------
| RATE LIMITING
|--------------------------------------------------------------------------
*/

// Authentication rate limiter
// Protects login/register from brute-force attempts.

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: 'Too many attempts. Please wait a few minutes and try again.',
  },
});


// General API rate limiter
// Generous enough for normal polling/chat/notification requests.

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});


/*
|--------------------------------------------------------------------------
| RATE LIMITER ROUTES
|--------------------------------------------------------------------------
*/

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/', generalLimiter);


/*
|--------------------------------------------------------------------------
| API ROUTES
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Smart Ride API is running.',
    time: new Date().toISOString(),
  });
});


/*
|--------------------------------------------------------------------------
| FRONTEND
|--------------------------------------------------------------------------
*/

// frontend is outside backend:
//
// smart-ride/
// ├── backend/
// │   └── server.js
// └── frontend/
//     └── index.html

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');


// Serve static frontend files
app.use(express.static(FRONTEND_DIR));


/*
|--------------------------------------------------------------------------
| FRONTEND FALLBACK
|--------------------------------------------------------------------------
*/

// Any non-API route that is not a static file
// loads the frontend index.html.

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});


/*
|--------------------------------------------------------------------------
| ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error('Server Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Unexpected server error.',
  });
});


/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

async function start() {
  try {
    console.log('==========================================================');
    console.log(' Starting Smart Ride...');
    console.log('==========================================================');

    // Connect database
    await connectDB();

    console.log('✅ Database connection successful');

    // Seed initial data
    await seedDatabase();

    console.log('✅ Database seeding completed');

    // Start reminder scheduler
    startReminderScheduler();

    console.log('✅ Reminder scheduler started');

    // Start HTTP server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('==========================================================');
      console.log(
        ' Smart Ride - Monthly Pickup & Drop Subscription Platform'
      );
      console.log('==========================================================');
      console.log(` Server running on port: ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(' Server host: 0.0.0.0');
      console.log('==========================================================');
    });

  } catch (error) {
    console.error('❌ Failed to start Smart Ride server');
    console.error(error);

    process.exit(1);
  }
}


/*
|--------------------------------------------------------------------------
| START APPLICATION
|--------------------------------------------------------------------------
*/

start();