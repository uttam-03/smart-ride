Smart Ride data files
=====================

- .env: local development configuration. Change JWT_SECRET before any public deployment.
- backend/data/demo-data.json: sample/reference data for plans, demo registration fields, and an illustrative map location.
- backend/data/smartride.sqlite: generated automatically by the application when you run `npm start`; it is not bundled as an empty database because Sequelize creates the schema at startup.

The app seeds the admin account and plans automatically on first startup. Demo admin login (local only): admin@smartride.com / admin123. Change this password before public use.

Important: demo-data.json is a reference file only and is not automatically imported by the app. Register a driver and commuter through the UI to create real test accounts. GPS coordinates are illustrative; real tracking needs browser location permission.
