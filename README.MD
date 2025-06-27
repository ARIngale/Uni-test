
# UNIBAZAR – Amazon SP API Integration

**UNIBAZAR** is a MERN stack application that allows users to register with email-based OTP verification, connect their Amazon Seller accounts using the Selling Partner (SP) API via OAuth, and view their total order count.

---

## 🚀 Features

- ✅ User registration with email OTP verification  
- 🔐 Secure authentication using JWT  
- 🛒 Amazon SP API OAuth integration  
- 📦 Fetch and display total Amazon order count  
- 💻 Responsive UI built with React + Tailwind CSS  

---

## 📁 Project Structure

```
project-root/
├── frontend/                # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/      
│   │   ├── context/         
│   │   ├── pages/           
│   │   ├── App.tsx          
│   │   └── index.tsx        
│   ├── package.json         
│   └── tailwind.config.js   
│
├── backend/                 # Express backend
│   ├── middleware/          
│   ├── models/              
│   ├── routes/              
│   ├── services/            
│   ├── utils/               
│   ├── server.js            
│   └── package.json         
│
└── README.md                # Documentation
```

---

## ⚙️ Prerequisites

- Node.js (v14 or above)
- MongoDB (local or cloud)
- Amazon Seller Central account
- Amazon SP API credentials (Client ID & Secret)

---

## 🧭 Setup Instructions (for ZIP usage)

> ⚠️ **Note**: After extracting the ZIP file, follow these steps for backend and frontend setup.

---

### 📦 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables file
cp .env.example .env
```

Edit the `.env` file with your own configuration:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/unibazar

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Email Configuration (for OTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_app_password

# Amazon SP API Configuration
AMAZON_CLIENT_ID=your_amazon_client_id
AMAZON_CLIENT_SECRET=your_amazon_client_secret
AMAZON_REDIRECT_URI=http://localhost:5000/amazon/callback
AMAZON_REGION=na
AMAZON_SANDBOX=true
```

Start the backend server:

```bash
npm run dev
```

---

### 💻 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create frontend config.ts file
echo "API_URL=http://localhost:5000" 

# Start the development server
npm start
```

---

## 🧾 Amazon SP API Registration Guide

1. Go to the [Amazon Developer Portal](https://developer.amazonservices.com/)
2. Sign in with your Amazon Seller account
3. Register as a developer
4. Create an application and note the Client ID and Secret
5. Set the OAuth Redirect URI:  
   `http://localhost:5000/amazon/callback`
6. Assign required API scopes (at minimum: **Orders**)

---

## 🌍 Environment Variables

### Backend

| Variable              | Description                                 |
|-----------------------|---------------------------------------------|
| `PORT`                | Port for backend server                     |
| `FRONTEND_URL`        | URL of frontend app                         |
| `MONGODB_URI`         | MongoDB connection string                   |
| `JWT_SECRET`          | Secret key for JWT tokens                   |
| `EMAIL_USER`          | Email to send OTPs                          |
| `EMAIL_PASSWORD`      | Email app password                          |
| `AMAZON_CLIENT_ID`    | Amazon SP API client ID                     |
| `AMAZON_CLIENT_SECRET`| Amazon SP API client secret                 |
| `AMAZON_REDIRECT_URI` | Amazon OAuth redirect URI                   |
| `AMAZON_REGION`       | Amazon SP API region (`na`, `eu`, `fe`)     |
| `AMAZON_SANDBOX`      | Enable sandbox mode (true/false)            |

### Frontend

| Variable              | Description                         |
|-----------------------|-------------------------------------|
| `REACT_APP_API_URL`   | URL of the backend server           |

---

## 📡 API Endpoints

### 🔐 Authentication

- `POST /api/auth/signup` – Register user  
- `POST /api/auth/verify-otp` – Verify OTP  
- `POST /api/auth/resend-otp` – Resend OTP  
- `POST /api/auth/login` – Login  

### 🛒 Amazon SP API

- `GET /api/amazon/auth-url` – Get Amazon OAuth URL  
- `POST /api/amazon/callback` – Handle Amazon callback  
- `GET /api/amazon/status` – Check if user is connected  
- `GET /api/amazon/orders` – Get total order count  

---