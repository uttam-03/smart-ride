# 🚗 Smart Ride

Smart Ride is a full-stack web application that I developed to manage
monthly pickup and drop transportation services.

The main idea behind this project was to create a single platform where
users can subscribe to ride plans, drivers can manage their assigned
rides, and administrators can manage the overall system.

I built this project using Node.js, Express.js, SQLite and a simple
HTML/CSS/JavaScript frontend.

---

## 🎯 Why I Built This Project

I wanted to build a practical project instead of just making a basic
CRUD application.

While developing Smart Ride, I worked on different parts of a real
web application such as:

- User authentication
- Role-based access
- Subscription management
- Payment records
- Driver management
- Complaints and ratings
- Notifications
- Ride tracking
- Admin dashboard
- API development
- Database management
- Deployment

This project helped me understand how frontend, backend and database
components work together in a complete application.

---

## ✨ Features

### 👤 User

- Register and login
- Browse available ride plans
- Subscribe to a plan
- View subscription details
- Manage payments
- Submit complaints
- Rate drivers
- Receive notifications
- Track rides

### 🚗 Driver

- Driver login
- View assigned rides
- Manage ride status
- View passenger information
- Update trip information
- Track assigned trips

### 🛠️ Admin

- Admin dashboard
- Manage users
- Manage drivers
- Manage subscription plans
- Manage payments
- Manage complaints
- Manage ratings
- Manage system settings
- View ride/trip information

---

## 🛠️ Technologies Used

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- SQLite
- Sequelize ORM

### Security
- JWT Authentication
- bcryptjs
- Helmet
- Express Rate Limit
- CORS

### Deployment
- GitHub
- Render

---

## 📁 Project Structure

```text
smart-ride/
│
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── data/
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
│
├── .gitignore
├── package-lock.json
└── README.md