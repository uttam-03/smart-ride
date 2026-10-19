# Smart Ride — Monthly Pickup & Drop Subscription Platform

A subscription-based commuting platform: fixed pickup/drop route, the **same driver and vehicle every day**, and predictable monthly/quarterly/yearly pricing — instead of on-demand, surge-priced cab booking.

---

## 1. Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript — no build step, no framework |
| Backend    | Node.js + Express (REST API) |
| Database   | **SQLite by default** (zero setup, single file) — or **MySQL** by changing one line in `.env`. Both go through the same Sequelize ORM, so nothing else changes. |
| Auth       | JWT + bcrypt, login by email **or** mobile number |
| Payments   | Real UPI transfers via QR code, verified manually by the admin — no payment gateway account needed |
| Maps       | Leaflet + OpenStreetMap (no API key required) |
| Security   | Helmet security headers + rate limiting on auth endpoints |

---

## 2. Folder Structure

```
smart-ride/
├── backend/
│   ├── config/
│   │   ├── database.js     # Sequelize instance (sqlite or mysql, from .env)
│   │   ├── db.js           # connects + creates tables on startup
│   │   ├── seed.js         # seeds default admin + plans on first run
│   │   └── reminders.js    # hourly renewal-reminder background job
│   ├── models/              # 13 Sequelize models (User, Driver, Subscription, Payment, ...)
│   ├── routes/               # auth, plans, subscriptions, payments, driver, admin, chat, ...
│   ├── middleware/auth.js   # JWT verification + role guard
│   ├── utils/                # dbHelpers, notify, assignDriver, tripStatus, ratings
│   ├── data/                 # smartride.sqlite lives here (created automatically)
│   ├── server.js             # entry point
│   ├── package.json
│   └── .env                  # PORT, JWT secret, DB config
└── frontend/
    ├── index.html            # landing page + plan listing
    ├── login.html / register.html
    ├── user-dashboard.html   # subscribe, pay, rides, profile, chat, ratings
    ├── driver-dashboard.html # riders, trip status, earnings, reviews, profile
    ├── admin-dashboard.html  # subscriptions, payments, drivers, plans, analytics
    ├── css/style.css
    └── js/api.js             # shared fetch/auth helper + chat/map/rating widgets
```

---

## 3. How to Run

### Prerequisites
- **Node.js v18+** (check with `node -v`)
- Nothing else — SQLite needs no separate install.

### Steps
```bash
cd smart-ride/backend
npm install
npm start
```

You should see:
```
✅ Database connected (sqlite)
🌱 Seeded default admin: admin@smartride.com / admin123
🌱 Seeded subscription plans
Server running at: http://localhost:5000
```

Open **http://localhost:5000** — frontend and backend both run from this one URL.\n\nThe included `backend/.env` is configured for local development only. Never use its demo JWT secret or default admin password on a public deployment; set a unique long `JWT_SECRET` and change/remove the demo admin credentials before exposing the app.

### Using MySQL instead
Open `backend/.env` and:
1. Create an empty database: `CREATE DATABASE smartride;`
2. Set `DB_DIALECT=mysql` and fill in `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (a commented template is already in the file)
3. `npm start` — tables are created automatically, same as SQLite

### If port 5000 is in use
Change `PORT=5000` in `backend/.env` to something else, then `npm start` again.

---

## 4. Setting Up UPI Payments

1. Log in as admin (`admin@smartride.com` / `admin123`) → **Settings** tab
2. Enter your UPI ID (e.g. `yourname@okhdfcbank`) and Save
3. Riders now see a QR code (auto-generated from your UPI ID + the exact plan amount) when they subscribe. They scan it, pay you directly, then submit the UTR/reference number, their UPI ID, and their name
4. You review it in **Payments** tab → Verify (activates the subscription + assigns a driver) or Reject

For a dry-run demo without real money: enter any 12-digit number as UTR and any name/UPI ID, then verify it yourself.

---

## 5. Demo Walkthrough

1. **Admin** (`admin@smartride.com` / `admin123`) → Settings tab → set a UPI ID
2. **Register a Driver** (incognito tab) → starts unverified
3. **Admin** → Drivers tab → Verify the new driver
4. **Register a Commuter** (another incognito tab) → set pickup/drop/city
5. **Commuter** → Subscribe tab → pick a plan → optionally click the map to set route pins → Create Subscription → scan/pay → submit UTR
6. **Admin** → Payments tab → Verify → driver auto-assigned (same city preferred)
7. **Driver** → My Riders tab → walk the trip through On the way → Arrived → Picked Up → Completed
8. **Commuter** → sees live trip status, can Chat with the driver, and Rate them after
9. **Admin** → Analytics KPIs update live; Plans tab to add/edit/retire pricing plans

---

## 6. Recent UI improvements\n\n- Live dashboard clock showing weekday, date, and seconds-updating local time.\n- Persistent Light/Dark theme toggle shared across dashboards.\n- Responsive dashboard navigation and improved card/table hover states.\n- Reduced-motion accessibility support and friendlier network error messages.\n\n## 7. Feature Checklist

- ✅ Signup/login by mobile **or** email, JWT + bcrypt
- ✅ Fixed subscription plans (monthly/quarterly/yearly), admin-editable pricing
- ✅ Driver onboarding + admin verification
- ✅ Auto driver assignment (same city preferred, least-loaded driver)
- ✅ Real UPI QR payments with manual admin verification + invoice numbers
- ✅ Live trip status (On the way → Arrived → Picked up → Completed), resets daily
- ✅ Driver ratings & reviews (1–5 stars + comment)
- ✅ In-app live chat between rider and assigned driver (admin has read-only oversight)
- ✅ Route shown on an interactive map (Leaflet/OpenStreetMap, no API key)
- ✅ Renewal reminders (3 days before expiry) + one-click renew
- ✅ Multi-city support with city filters on admin tables
- ✅ Profile editing + password change for riders and drivers
- ✅ Complaints/feedback system with admin resolution
- ✅ Admin analytics: active subscriptions, MRR, retention rate, driver utilization, avg. complaint resolution time
- ✅ Security: Helmet headers, rate limiting on login/register
- ✅ Mobile-responsive UI

**Out of scope** (by design): on-demand ride booking, inter-city travel, real-time fare negotiation.

---

## 7. Notes for Your Submission / Viva

- Switching between SQLite and MySQL is a **one-line config change** (`DB_DIALECT` in `.env`) — the same Sequelize models and routes work with either, which is exactly what a real deployment would want (SQLite for local dev/demo, MySQL for production).
- Payments are real UPI transfers with **manual admin verification** as the trust layer — a legitimate pattern for accepting real money without a payment-gateway merchant account.
- Driver auto-assignment picks the **verified driver in the same city with the fewest active riders**, falling back to any verified driver if no same-city match exists.
- Chat and live trip status use short polling (every few seconds while a page is open) rather than WebSockets — simple, reliable, and needs no extra infrastructure.

---

## 8. Future Enhancements
Mobile apps (Android/iOS), live GPS tracking, corporate/bulk subscriptions, AI-based route optimization, SOS/emergency features, a real payment gateway (Razorpay/Stripe) as an alternative to manual UPI verification, SMS notifications, Google Maps integration.


## Live driver tracking (added)

- Drivers can press **Share live location** on an assigned rider card. The browser asks for GPS permission and posts coordinates to the authenticated tracking API.
- Riders can press **Track Driver Live** from an active subscription to open an interactive Leaflet map. The map refreshes every 5 seconds and shows the latest driver position plus saved pickup/drop points.
- Location access is restricted by the API: a driver can publish only for their own active assigned subscription, and a rider can read only their own active subscription.
- GPS sharing requires browser permission and HTTPS in deployed environments (localhost is allowed for development). Drivers should stop sharing when the trip ends; closing the dashboard stops browser GPS watches.
- Existing databases are upgraded additively at startup with nullable tracking columns; no trip or account rows are intentionally deleted.
- Map tiles use OpenStreetMap. Accurate GPS depends on the device and permission settings; this feature does not claim to provide turn-by-turn road routing.

## Route-aware driver assignment (updated)

The admin Subscriptions table now has a **Smart assign** action for active subscriptions. It asks the backend for a ranked shortlist, shows the best match and its reasons, and assigns only after admin confirmation. The existing manual driver dropdown remains available.

Matching rules:
- only verified drivers are eligible;
- if the subscription has a city, drivers must be registered in that same city (no cross-city fallback);
- drivers at the demo capacity of 8 active subscriptions are skipped;
- existing active subscriptions are compared for matching pickup/drop labels, pickup/drop coordinates when available, pickup-time proximity, and current workload;
- after assignment, customer and driver receive notifications.

Payment verification uses the same route-aware selection when it activates a subscription. If no suitable verified driver is available, the subscription activates without a driver and the customer is notified that assignment is pending.

**Important limitation:** this is route-overlap matching, not live road-network optimization. The current Driver model does not store driver start coordinates, shift hours, seat capacity, or vehicle GPS. For production-grade routing, add those fields and integrate a routing service (for example, OSRM/Google Maps) and driver availability/live-location data. Coordinates are optional; when they are missing, the algorithm uses same-city eligibility, matching route labels, time, and workload.
